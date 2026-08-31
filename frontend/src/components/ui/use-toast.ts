import toast from 'react-hot-toast';

export const useToast = () => {
    return {
        toast: ({ title, description, variant }: { title?: string, description?: string, variant?: 'default' | 'destructive' }) => {
            const message = `${title ? title + ': ' : ''}${description || ''}`;
            if (variant === 'destructive') {
                toast.error(message);
            } else {
                toast.success(message);
            }
        }
    };
};
