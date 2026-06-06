import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { apiClient } from "../lib/apiClient";

const couponsKey = ["coupons"] as const;
const pageSize = 25;

export function useCouponsPage() {
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: [...couponsKey, "page", cursor],
    queryFn: () => apiClient.listCouponsPage({ limit: pageSize, cursor })
  });
  return { ...query, cursor, nextCursor: query.data?.page.nextCursor, setCursor };
}
