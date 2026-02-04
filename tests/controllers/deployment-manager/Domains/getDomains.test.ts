import getDomains from "@/controllers/deployment-manager/Domains/getDomains";
import { StatusCode } from "@/types/types";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    userDomains: {}
}));

describe("getDomains", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return domains", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, domain_address: "example.com" }]);
        const result = await getDomains({ userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", data: [{ id: 1, domain_address: "example.com" }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
