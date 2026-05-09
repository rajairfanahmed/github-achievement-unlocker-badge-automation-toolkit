/**
 * Discussion operations for GitHub API (used for Galaxy Brain achievement)
 * Note: GitHub Discussions uses GraphQL API
 */

import type { DiscussionInfo } from '../types/index.js';
import { getGitHubClient, getHelperClient } from './client.js';
import { DiscussionsNotEnabledError, GitHubAPIError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// GraphQL query for getting repository discussion categories
const GET_DISCUSSION_CATEGORIES_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      id
      discussionCategories(first: 10) {
        nodes {
          id
          name
          isAnswerable
        }
      }
    }
  }
`;

// GraphQL mutation for creating a discussion
const CREATE_DISCUSSION_MUTATION = `
  mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {
      repositoryId: $repositoryId,
      categoryId: $categoryId,
      title: $title,
      body: $body
    }) {
      discussion {
        id
        number
        title
        url
        category {
          id
          name
        }
      }
    }
  }
`;

// GraphQL mutation for adding a discussion comment
const ADD_DISCUSSION_COMMENT_MUTATION = `
  mutation($discussionId: ID!, $body: String!) {
    addDiscussionComment(input: {
      discussionId: $discussionId,
      body: $body
    }) {
      comment {
        id
        body
      }
    }
  }
`;

// GraphQL mutation for marking a comment as answer
const MARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION = `
  mutation($commentId: ID!) {
    markDiscussionCommentAsAnswer(input: {
      id: $commentId
    }) {
      discussion {
        id
        answerChosenAt
      }
    }
  }
`;

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

interface CategoryNode {
  id: string;
  name: string;
  isAnswerable: boolean;
}

interface DiscussionCategoriesData {
  repository: {
    id: string;
    discussionCategories: {
      nodes: CategoryNode[];
    };
  } | null;
}

interface CreateDiscussionData {
  createDiscussion: {
    discussion: {
      id: string;
      number: number;
      title: string;
      url: string;
      category: {
        id: string;
        name: string;
      };
    };
  };
}

interface AddCommentData {
  addDiscussionComment: {
    comment: {
      id: string;
      body: string;
    };
  };
}

/**
 * Execute a GraphQL query with the main client
 */
async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const client = getGitHubClient();

  const response = await client.api.graphql<T>(query, variables);
  return response;
}

/**
 * Execute a GraphQL query with the helper client (for Galaxy Brain two-account mode)
 */
async function helperGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const helper = getHelperClient();
  if (!helper) {
    throw new Error('Helper client not initialized. Configure HELPER_TOKEN for Galaxy Brain.');
  }

  const response = await helper.api.graphql<T>(query, variables);
  return response;
}

/**
 * Get discussion categories for a repository
 */
export async function getDiscussionCategories(
  owner: string,
  repo: string
): Promise<CategoryNode[]> {
  logger.debug(`Fetching discussion categories for ${owner}/${repo}`);

  try {
    const response = await graphql<DiscussionCategoriesData>(
      GET_DISCUSSION_CATEGORIES_QUERY,
      { owner, repo }
    );

    if (!response.repository) {
      throw new DiscussionsNotEnabledError(`${owner}/${repo}`);
    }

    const categories = response.repository.discussionCategories.nodes;

    if (categories.length === 0) {
      throw new DiscussionsNotEnabledError(`${owner}/${repo}`);
    }

    return categories;
  } catch (error) {
    const anyError = error as { message?: string };
    if (anyError.message?.includes('Could not resolve to a Repository')) {
      throw new DiscussionsNotEnabledError(`${owner}/${repo}`);
    }
    throw error;
  }
}

/**
 * Get an answerable discussion category
 */
export async function getAnswerableCategory(
  owner: string,
  repo: string
): Promise<CategoryNode> {
  const categories = await getDiscussionCategories(owner, repo);

  // Find Q&A category first
  const qnaCategory = categories.find(
    c => c.isAnswerable && (c.name.toLowerCase().includes('q&a') || c.name.toLowerCase().includes('question'))
  );

  if (qnaCategory) {
    return qnaCategory;
  }

  // Fall back to any answerable category
  const answerable = categories.find(c => c.isAnswerable);

  if (!answerable) {
    throw new GitHubAPIError(
      422,
      'discussions',
      'No answerable discussion category found. Please create a Q&A category in repository settings.'
    );
  }

  return answerable;
}

/**
 * Get repository ID for GraphQL operations
 */
export async function getRepositoryId(owner: string, repo: string): Promise<string> {
  const response = await graphql<DiscussionCategoriesData>(
    GET_DISCUSSION_CATEGORIES_QUERY,
    { owner, repo }
  );

  if (!response.repository) {
    throw new DiscussionsNotEnabledError(`${owner}/${repo}`);
  }

  return response.repository.id;
}

/**
 * Create a discussion
 */
export async function createDiscussion(
  owner: string,
  repo: string,
  options: {
    title: string;
    body: string;
    categoryId?: string;
  }
): Promise<DiscussionInfo> {
  logger.debug(`Creating discussion: ${options.title}`);

  // Get repository ID and category if not provided
  const repoId = await getRepositoryId(owner, repo);
  let categoryId = options.categoryId;

  if (!categoryId) {
    const category = await getAnswerableCategory(owner, repo);
    categoryId = category.id;
  }

  const response = await graphql<CreateDiscussionData>(
    CREATE_DISCUSSION_MUTATION,
    {
      repositoryId: repoId,
      categoryId,
      title: options.title,
      body: options.body,
    }
  );

  const discussion = response.createDiscussion.discussion;

  logger.verbose(`Created discussion #${discussion.number}`);

  return {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    url: discussion.url,
    category: discussion.category,
  };
}

/**
 * Add a comment to a discussion
 */
export async function addDiscussionComment(
  discussionId: string,
  body: string
): Promise<string> {
  logger.debug(`Adding comment to discussion ${discussionId}`);

  const response = await graphql<AddCommentData>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId,
      body,
    }
  );

  const commentId = response.addDiscussionComment.comment.id;
  logger.verbose(`Added comment ${commentId}`);

  return commentId;
}

/**
 * Mark a comment as the accepted answer
 */
export async function markCommentAsAnswer(commentId: string): Promise<void> {
  logger.debug(`Marking comment ${commentId} as answer`);

  await graphql(
    MARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION,
    { commentId }
  );

  logger.verbose(`Marked comment as answer`);
}

/**
 * Create a discussion with an accepted answer (for Galaxy Brain)
 */
export async function createDiscussionWithAnswer(
  owner: string,
  repo: string,
  options: {
    title: string;
    questionBody: string;
    answerBody: string;
  }
): Promise<DiscussionInfo> {
  // Create the discussion
  const discussion = await createDiscussion(owner, repo, {
    title: options.title,
    body: options.questionBody,
  });

  // Add an answer comment
  const commentId = await addDiscussionComment(discussion.id, options.answerBody);

  // Mark the comment as the accepted answer
  await markCommentAsAnswer(commentId);

  logger.info(`Created discussion #${discussion.number} with accepted answer`);

  return discussion;
}

/**
 * Create a Galaxy Brain achievement discussion using two-account mode
 *
 * Flow:
 * 1. Helper account creates the discussion (question)
 * 2. Main account adds an answer
 * 3. Helper account marks the main account's answer as accepted
 * 4. Main account gets Galaxy Brain credit!
 */
export async function createGalaxyBrainDiscussion(
  owner: string,
  repo: string,
  number: number
): Promise<DiscussionInfo> {
  const helper = getHelperClient();
  if (!helper) {
    throw new Error(
      'Galaxy Brain requires a helper account. Configure HELPER_TOKEN in your .env file.\n' +
      'The helper account creates questions, your main account answers them.'
    );
  }

  const timestamp = new Date().toISOString();

  const title = `Question #${number} - ${timestamp.split('T')[0]}`;
  const questionBody = `**Question #${number}**

Looking for help with this topic.

Timestamp: ${timestamp}

---
*Created by GitHub Achievements Manager*`;

  const answerBody = `**Answer**

Here's the solution to this question.

Timestamp: ${timestamp}

---
*Created by GitHub Achievements Manager*`;

  logger.debug(`Creating Galaxy Brain discussion #${number} (two-account mode)`);

  // Step 1: Helper account creates the discussion
  const repoId = await getRepositoryIdWithHelper(owner, repo);
  const category = await getAnswerableCategory(owner, repo);

  const discussionResponse = await helperGraphql<CreateDiscussionData>(
    CREATE_DISCUSSION_MUTATION,
    {
      repositoryId: repoId,
      categoryId: category.id,
      title,
      body: questionBody,
    }
  );

  const discussion = discussionResponse.createDiscussion.discussion;
  logger.verbose(`Helper created discussion #${discussion.number}`);

  // Step 2: Main account adds an answer
  const commentResponse = await graphql<AddCommentData>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId: discussion.id,
      body: answerBody,
    }
  );

  const commentId = commentResponse.addDiscussionComment.comment.id;
  logger.verbose(`Main account added answer comment`);

  // Step 3: Helper account marks the main account's answer as accepted
  await helperGraphql(
    MARK_DISCUSSION_COMMENT_AS_ANSWER_MUTATION,
    { commentId }
  );

  logger.info(`Galaxy Brain #${number} completed (Discussion #${discussion.number})`);

  return {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    url: discussion.url,
    category: discussion.category,
  };
}

/**
 * Get repository ID using helper client
 */
async function getRepositoryIdWithHelper(owner: string, repo: string): Promise<string> {
  const response = await helperGraphql<DiscussionCategoriesData>(
    GET_DISCUSSION_CATEGORIES_QUERY,
    { owner, repo }
  );

  if (!response.repository) {
    throw new DiscussionsNotEnabledError(`${owner}/${repo}`);
  }

  return response.repository.id;
}

/**
 * Check if discussions are enabled for a repository
 */
export async function areDiscussionsEnabled(
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    const repoInfo = await getGitHubClient().getRepository(owner, repo);
    return repoInfo.hasDiscussions;
  } catch (error) {
    logger.debug(`Could not read repository Discussions flag: ${error}`);
  }

  try {
    await getDiscussionCategories(owner, repo);
    return true;
  } catch (error) {
    if (error instanceof DiscussionsNotEnabledError) {
      return false;
    }
    throw error;
  }
}

export default {
  getDiscussionCategories,
  getAnswerableCategory,
  createDiscussion,
  addDiscussionComment,
  markCommentAsAnswer,
  createDiscussionWithAnswer,
  createGalaxyBrainDiscussion,
  areDiscussionsEnabled,
};
