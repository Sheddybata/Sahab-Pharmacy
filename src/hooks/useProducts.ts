import { useQuery } from '@tanstack/react-query';
import { fetchActiveProducts } from '@/services/products';

export const PRODUCT_QUERY_KEY = ['products', 'active'];

export function useProducts() {
  return useQuery({
    queryKey: PRODUCT_QUERY_KEY,
    queryFn: fetchActiveProducts,
  });
}


