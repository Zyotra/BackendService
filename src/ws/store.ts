import { Server } from "bun";
export const serverStore = {
    server: null as Server<unknown> | null
};
export default serverStore;
