import { GetAuthorHandler } from './get-author/get-author.handler';
import { getAllAuthorsHandler } from './get-all-authors/get-all-authors.handler';

export const QueryHandlers = [
  GetAuthorHandler,
  getAllAuthorsHandler,
];
