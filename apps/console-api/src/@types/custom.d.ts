declare namespace Express {
  export interface Request {
    user: {
      id: string,
    },
    adminUser?: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      permissions: string[];
    };
  }
}
