import { StorageProvider } from '../lib/storage/types';
interface FileExplorerProps {
    storage: StorageProvider;
    onClose: () => void;
    syncLogs?: string[];
    onOpenFile?: (path: string) => void;
}
export default function FileExplorer(props: FileExplorerProps): import("react/jsx-runtime").JSX.Element;
export {};
