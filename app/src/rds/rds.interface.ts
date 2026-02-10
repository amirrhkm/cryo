export interface IRdsResource {
    identifier: string;
    type: 'cluster' | 'instance';
}

export interface IRdsCluster {
    identifier: string;
    status: string;
}

