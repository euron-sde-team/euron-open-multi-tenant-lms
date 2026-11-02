import { Router } from "express";
import v1Router from "./v1.route";

const rootRouter: Router = Router();

rootRouter.use("/v1", v1Router);

export default rootRouter;