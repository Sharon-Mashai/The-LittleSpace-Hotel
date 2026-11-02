import { apiRequest } from "./api";

export type RoomType = {
  id: number;
  branch_id: number;
  name: string;
  description: string | null;
  capacity_adults: number;
  capacity_children: number;
  base_price: number;
  currency: string;
  facilities: string[] | null;
  policies: Record<string, unknown> | null;
};

type RoomTypesResponse = {
  success: boolean;
  count: number;
  data: RoomType[];
};

export async function getBranchRoomTypes(
  branchId: number,
): Promise<RoomType[]> {
  const response = await apiRequest<RoomTypesResponse>(
    `/room-types/branch/${branchId}`,
  );

  return response.data;
}
