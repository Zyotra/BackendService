import addNewDomain from "@/controllers/deployment-manager/Domains/addNewDomain";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    userDomains: {}
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("addNewDomain", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { domainAddress: "example.com", vpsIp: "1.2.3.4" };
    });

    it("should add new domain", async () => {
        const userId = "1";
        mockDb.where.mockResolvedValue([]); // Domain does not exist
        mockDb.returning.mockResolvedValue({ id: 1, ...mockBody });

        const result = await addNewDomain({ body: mockBody, set: mockSet, userId } as any);

        expect(result).toMatchObject({ status: "success" });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should fail if domain exists", async () => {
        mockDb.where.mockResolvedValue([{ id: 1 }]); // Exists
        const result = await addNewDomain({ body: mockBody, set: mockSet, userId: "1" } as any);
        expect(result).toMatchObject({ status: "error", message: "Domain already exists" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
