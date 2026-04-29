import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { db } from "../../../db/client";
import { vpsMachines } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import SSHClient from "../../../SSHClient/SSHClient";
import decryptVpsPassword from "../../../crypto/decryptVpsPassword";
const createSwapMemoryController = async ({
  body,
  set,
  userId,
}: Context | any) => {
  const req = body as { vpsId: number; memory: number };
  const { vpsId, memory } = req;
  if (!vpsId || !memory) {
    set.status = StatusCode.BAD_REQUEST;
    return {
      message: "Invalid request body",
    };
  }
  if (memory >= 8 || memory <= 1) {
    set.status = StatusCode.BAD_REQUEST;
    return {
      message: "You cannot create swap memory more than 8 GB or less than 1 GB",
    };
  }
  var ssh: SSHClient | null = null
  const owner = parseInt(userId);
  const machines = await db
    .select({
      vps_ip:vpsMachines.vps_ip,
      vps_password:vpsMachines.vps_password
    })
    .from(vpsMachines)
    .where(and(eq(vpsMachines.ownerId, owner), eq(vpsMachines.id, vpsId)));
  if (machines.length == 0) {
    set.status = StatusCode.NOT_FOUND
    return {
      message: "Invalid machine details or unauthorized machine selected."
    }
  }
  const vpsMachine = machines[0];
  const hashedPassword = decryptVpsPassword(vpsMachine.vps_password)
  try {
    const swapMemoryCommands: string[] = []
    ssh = new SSHClient({
      host: vpsMachine.vps_ip,
      username: "root",
      password: hashedPassword
    })
    await ssh.runSequential(swapMemoryCommands)
  } catch (error) {
    set.status = StatusCode.INTERNAL_SERVER_ERROR
    return {
      message: "Error while creating swap memory",
      error: error
    }
  } finally {
    if (ssh) {
      ssh.close()
    }
  }
};
export default createSwapMemoryController;
