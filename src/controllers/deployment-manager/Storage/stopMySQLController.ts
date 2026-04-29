import { Context } from "elysia";
import SSHClient from "../../../SSHClient/SSHClient";
import { vpsMachines } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { StatusCode } from "../../../types/types";
import decryptVpsPassword from "../../../crypto/decryptVpsPassword";
import { db } from "../../../db/client";
const stopMySQLController = async ({ params, set, userId }: Context | any) => {
  const vpsId: number = params.id;
  var ssh: SSHClient | null = null
  const owner = parseInt(userId);
  const machines = await db
    .select({
      vps_ip: vpsMachines.vps_ip,
      vps_password: vpsMachines.vps_password
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
    const stopMysql: string[] = [
      "sudo systemctl stop mysql",
      "sudo systemctl disable mysql"
    ];
    ssh = new SSHClient({
      host: vpsMachine.vps_ip,
      username: "root",
      password: hashedPassword
    })
    await ssh.runSequential(stopMysql)
  } catch (error) {
    set.status = StatusCode.INTERNAL_SERVER_ERROR
    return {
      message: "Error while stopping mysql server",
      error: error
    }
  } finally {
    if (ssh) {
      ssh.close()
    }
  }
}
export default stopMySQLController