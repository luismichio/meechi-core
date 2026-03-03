export declare class ClientDriveService {
    private accessToken;
    constructor();
    setToken(token: string): void;
    private request;
    listFiles(): Promise<any>;
    getFileContent(fileId: string): Promise<string>;
}
export declare const clientDrive: ClientDriveService;
