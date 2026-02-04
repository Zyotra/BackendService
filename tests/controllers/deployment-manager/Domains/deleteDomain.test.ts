import deleteDomain from "@/controllers/deployment-manager/Domains/deleteDomain";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    userDomains: {}
}));

describe("deleteDomain", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should delete domain if user is owner and not deployed", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, ownerId: 1, isDeployed: false }]);
        const result = await deleteDomain({ params: { id: "1" }, set: mockSet, userId: "1" } as any);

        expect(result).toMatchObject({ status: "success", message: "Domain deleted successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should fail if domain is deployed", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, ownerId: 1, isDeployed: true }]);
        const result = await deleteDomain({ params: { id: "1" }, set: mockSet, userId: "1" } as any);

        expect(result).toMatchObject({ status: "error", message: "Cannot delete a deployed domain. Please undeploy it first." });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });

    it("should fail if unauthorized", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, ownerId: 2 }]);
        const result = await deleteDomain({ params: { id: "1" }, set: mockSet, userId: "1" } as any);

        expect(result).toMatchObject({ status: "error", message: "Unauthorized to delete this domain" });
        expect(mockSet.status).toBe(StatusCode.UNAUTHORIZED);
    });
});
