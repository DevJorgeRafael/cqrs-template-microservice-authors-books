import { CreateAuthorHandler } from './create-author/create-author.handler';
import { UpdateAuthorHandler } from './update-author/update-author.handler';
import { DeleteAuthorHandler } from './delete-author/delete-author.handler';

export const CommandHandlers = [
  CreateAuthorHandler,
  UpdateAuthorHandler,
  DeleteAuthorHandler,
];
