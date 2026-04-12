export interface LicenseModalProps {
    modelId: string;
    modelName: string;
    license: string | undefined;
    termsUrl?: string;
    estimatedDownloadMB?: number;
}
export declare function showLicenseModal(props: LicenseModalProps): Promise<boolean>;
