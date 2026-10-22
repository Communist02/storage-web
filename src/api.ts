import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { url } from "./url";
import type { File } from "./App";

class ErrorResponse implements AxiosResponse {
    data: any;
    status: number;
    statusText: string;
    headers: any;
    config: InternalAxiosRequestConfig;
    request?: any;

    constructor(error: AxiosError) {
        if (error.response) {
            this.data = error.response.data;
            this.status = error.response.status;
            this.statusText = error.response.statusText;
            this.headers = error.response.headers;
            this.config = error.response.config;
            this.request = error.response.request;
        } else {
            this.data = null;
            this.status = error.status ?? 0;
            this.statusText = error.code ?? "NETWORK_ERROR";
            this.headers = {};
            this.config = (error.config ?? {}) as InternalAxiosRequestConfig;
            this.request = error.request;
        }
    }

    toString() {
        if (this.data?.detail) return `${this.status}: ${this.data.detail}`;
        if (this.statusText) return `${this.status}: ${this.statusText}`;
        return "Unknown error";
    }
}

export class ApiClient {
    private api;
    public token: string = '';

    constructor() {
        this.api = axios.create({
            baseURL: url,
            timeout: 10000,
            validateStatus: () => true,
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });
    }

    private normalizeErrorResponse(error: AxiosError): AxiosResponse {
        return new ErrorResponse(error);
    }

    private handleError(error: AxiosError, context?: string): AxiosResponse {
        console.error(`[${context}] Ошибка запроса:`, error);
        return this.normalizeErrorResponse(error);
    }

    public updateToken(token: string) {
        this.api = axios.create({
            baseURL: url,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        this.token = token;
    }

    public async checkToken(): Promise<AxiosResponse> {
        try {
            const response = await this.api.get('/user/session');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_session");
        }
    }

    public async deleteSession(): Promise<AxiosResponse> {
        try {
            const response = await this.api.delete('/user/session');
            return response.data;
        } catch (error) {
            return this.handleError(error as AxiosError, "delete_session");
        }
    }

    public downloadFile = async (files: File[], collection_id: number) => {
        if (files.length === 0) return;

        function strip(str: string) {
            if (str.startsWith('/')) str = str.slice(1);
            return str;
        }

        try {
            let new_url;
            if (files.length === 1 && !files[0].isDirectory) {
                new_url = `${this.api.defaults.baseURL}/collections/${collection_id}/files/${strip(files[0].path)}`;
            } else {
                const fileQuery = 'files=' + encodeURIComponent(files.map((file) => `${file.isDirectory ? file.path + '/' : file.path}`).join('|'));
                new_url = `${this.api.defaults.baseURL}/collections/${collection_id}/archive?${fileQuery}`;
            }
            if (window.location.hostname !== new URL(url).hostname) {
                if (files.length === 1 && !files[0].isDirectory) {
                    new_url += `?token=${this.token}`
                } else {
                    new_url += `&token=${this.token}`
                }
            } else {
                document.cookie = `token=${this.token}; path=/; SameSite=Lax`;
            }
            window.location.href = new_url;
        } catch (error) {
            return this.handleError(error as AxiosError, "download");
        }
    };

    public createFolder = async (name: string, path: string, collection_id: number) => {
        try {
            const response = await this.api.post(`/collections/${collection_id}/create_directory`, { name, path });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "create_directory");
        }
    };

    public deleteFiles = async (collection_id: number, files: File[]) => {
        const fileQuery = 'files=' + encodeURIComponent(files.map((file) => `${file.isDirectory ? file.path + '/' : file.path}`).join('|'));
        try {
            const response = await this.api.delete(`/collections/${collection_id}/files?${fileQuery}`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "delete_files");
        }
    };

    public copyFiles = async (source_collection_id: number, source_paths: string[], destination_collection_id: number, destination_path: string) => {
        try {
            const response = await this.api.post("/collections/copy", { source_collection_id, source_paths, destination_collection_id, destination_path });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "copy_files");
        }
    };

    public getFiles = async (collection_id: number, path: string = '', recursive = true) => {
        try {
            const response = await this.api.get('/collections/' + collection_id + '/list/' + encodeURIComponent(path) + '?recursive=' + recursive);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_files");
        }
    };

    public getCollections = async () => {
        try {
            const response = await this.api.get('/collections');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_collections");
        }
    };

    public getFreeCollections = async (collection_ids: number[]) => {
        const ids = collection_ids.join(',');
        try {
            const response = await this.api.get('/collections', { params: { ids } });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_specific_collection");
        }
    };

    public searchCollections = async (text: string) => {
        try {
            const response = await this.api.get('/collections/search', { params: { text } });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_session");
        }
    };

    public rename = async (path: string, new_name: string, collection_id: number) => {
        try {
            const response = await this.api.post('/collections/' + collection_id + '/rename', { path, new_name });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "rename");
        }
    };

    public createCollection = async (name: string) => {
        try {
            const response = await this.api.post('/collections/create?name=' + name);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getGroups = async () => {
        try {
            const response = await this.api.get('/groups');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public createGroup = async (title: string, description: string) => {
        try {
            const response = await this.api.post('/groups/create', { title, description });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public removeCollection = async (collection_id: number) => {
        try {
            const response = await this.api.delete(`/collections/${collection_id}`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getOtherUsers = async () => {
        try {
            const response = await this.api.get('/users');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public giveAccessUserToCollection = async (collection_id: number, user_id: number, access_type_id: number) => {
        try {
            const response = await this.api.post(`/collections/${collection_id}/access/user`, { user_id, access_type_id });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public giveAccessGroupToCollection = async (collection_id: number, group_id: number, access_type_id: number) => {
        try {
            const response = await this.api.post(`/collections/${collection_id}/access/group`, { group_id, access_type_id });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getAccessToCollection = async (collection_id: number) => {
        try {
            const response = await this.api.get(`/collections/${collection_id}/access`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public deleteAccess = async (access_id: number) => {
        try {
            const response = await this.api.delete(`/access/${access_id}`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public deleteUserToGroup = async (group_id: number, user_id: number) => {
        try {
            const response = await this.api.delete(`/groups/${group_id}/users/${user_id}`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public addUserToGroup = async (group_id: number, user_id: number, role_id: number) => {
        try {
            const response = await this.api.post(`/groups/${group_id}/users`, { user_id, role_id });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getGroupUsers = async (group_id: number) => {
        try {
            const response = await this.api.get(`/groups/${group_id}/users`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getAccessTypes = async () => {
        try {
            const response = await this.api.get('/access/types');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public transferPowerToGroup = async (group_id: number, user_id: number) => {
        try {
            const response = await this.api.post(`/groups/${group_id}/transfer_power?user_id=${user_id}`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public exitGroup = async (group_id: number) => {
        try {
            const response = await this.api.post(`/groups/${group_id}/exit`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public changeRoleInGroup = async (group_id: number, user_id: number, role_id: number) => {
        try {
            const response = await this.api.patch(`/groups/${group_id}/users/${user_id}/role` + '?role_id=' + role_id);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public async getUserInfo(): Promise<AxiosResponse> {
        try {
            const response = await this.api.get('/user/info');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_user_info");
        }
    };

    public changeAccessType = async (access_id: number, access_type_id: number) => {
        try {
            const response = await this.api.patch(`/access/${access_id}/type` + '?access_type_id=' + access_type_id);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "change_access_type");
        }
    };

    public changeGroupInfo = async (group_id: number, title: string, description: string) => {
        try {
            const response = await this.api.patch(`/groups/${group_id}/info`, { title, description });
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "change_group_info");
        }
    };

    public async getLogs(): Promise<AxiosResponse> {
        try {
            const response = await this.api.get('/logs');
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_logs");
        }
    };

    public async getHistoryCollection(collection_id: number): Promise<AxiosResponse> {
        try {
            const response = await this.api.get(`/collections/${collection_id}/history`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "get_history_collection");
        }
    };

    public changeCollectionInfo = async (collection_id: number, data: {}) => {
        try {
            const response = await this.api.patch(`/collections/${collection_id}/info`, data);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getCollectionInfo = async (collection_id: number) => {
        try {
            const response = await this.api.get(`/collections/${collection_id}/info`);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public getFileInfo = async (collection_id: number, path: string, is_dir: boolean) => {
        try {
            const response = await this.api.get('/collections/' + collection_id + '/file_info/' + encodeURIComponent(path) + '?is_dir=' + is_dir);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public indexFile = async (collection_id: number, path: string) => {
        try {
            const response = await this.api.post('/collections/' + collection_id + '/indexing_file/' + encodeURIComponent(path));
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

    public changeAccessToAll = async (collection_id: number, is_access: boolean) => {
        try {
            const response = await this.api.patch(`/collections/${collection_id}/access_to_all` + '?is_access=' + is_access);
            return response;
        } catch (error) {
            return this.handleError(error as AxiosError, "");
        }
    };

}

export const apiClient = new ApiClient();