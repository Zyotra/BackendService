import { Context } from "elysia";
import { githubAuths } from "../../../db/schema";
import { db } from "../../../db/client";
import { eq } from "drizzle-orm";
import { StatusCode } from "../../../types/types";

const getGithubStatusController = async ({ params, set }: Context | any) => {
    const vpsId = params.id;
    if (!vpsId) {
        return {
            status: "error",
            message: "Missing VPS ID"
        }
    }
    const githubAuth = await db.select({
        github_username:githubAuths.github_username
    }).from(githubAuths).where(eq(githubAuths.vpsId, vpsId));
    if (githubAuth.length === 0) {
        set.status = StatusCode.NOT_FOUND;
        return {
            status: "error",
            message: "No GitHub authentication found for the specified VPS"
        }
    }
    set.status = StatusCode.OK;
    return {
        status: "success",
        data: githubAuth[0]
    }
}
export default getGithubStatusController;