// types/express.d.ts
import { User } from "../../generated/prisma";
import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: User;
}
