import { AssignAuthorBookHandler } from "./assign-author-book/assign-author-book.handler";
import { UnassignAuthorBookHandler } from "./unassign-author-book/unassign-author-book.handler";

export const CommandHandlers = [
    AssignAuthorBookHandler,
    UnassignAuthorBookHandler,
];
