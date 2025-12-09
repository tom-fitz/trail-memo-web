import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memosApi } from '@/lib/api/memos';

export const useMemos = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['memos'],
    queryFn: () => memosApi.getAll({ limit: 500 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: (memoId: string) => memosApi.delete(memoId),
    onSuccess: () => {
      // Invalidate and refetch memos after deletion
      queryClient.invalidateQueries({ queryKey: ['memos'] });
    },
  });

  return {
    memos: data?.memos || [],
    isLoading,
    error,
    refetch,
    deleteMemo: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};

export const useMemo = (id: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['memo', id],
    queryFn: () => memosApi.getById(id),
    enabled: !!id,
  });

  return {
    memo: data,
    isLoading,
    error,
  };
};

