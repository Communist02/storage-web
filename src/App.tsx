import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import './App.css';
import AuthPage from './auth/AuthPage';
import Groups from './groups/Groups';
import { Button, Dropdown, Select, Result, Flex, Space, Tag, ConfigProvider, App as AntApp, theme, Layout, Card, Drawer, Modal, Input, FloatButton, Tooltip, Spin, message as Message } from 'antd';
import { LogoutOutlined, TeamOutlined, UserOutlined, HistoryOutlined, UploadOutlined, SunOutlined, SettingOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { url } from "./url";
import ruRU from 'antd/locale/ru_RU';
import Uploader from './uploader/Uploader';
import Logs from './logs-view/Logs';
import History from './history/History';
import CollectionPage from './control_panel/CollectionPage';
import ProfilePage from './control_panel/ProfilePage';
import CollectionsSearch from './collections-search/CollectionsSearch';
import { useAuth } from 'react-oidc-context';
import { apiClient } from './api';
import { useLocation, useNavigate } from 'react-router-dom';
import FileProperties from './file-properties/FileProperties';
import type { User } from 'oidc-client-ts';
// @ts-ignore
const FileManager = lazy(() => import('./file_manager/FileManager/FileManager'));

export interface Collection {
    id: number;
    name: string;
    access_type_id: number;
    type: string;
    is_access_all: boolean;
}

export interface File {
    isDirectory: boolean;
    path: string;
    name: string;
    size: number;
}

export const filesEndpoint = 'files';

function App() {
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<Collection[] | {}[]>([]);
    const [buckets, setBuckets] = useState<Collection[]>([]);
    const [currentBucket, setCurrentBucket] = useState<Collection | null>(null);
    const [tokenAuth, setTokenAuth] = useState<string | null>(null);
    const [showControlPanel, setShowControlPanel] = useState(false);
    const copyCollection = useRef<Collection | null>(null);
    const [openUploader, setOpenUploader] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);
    const [openCollection, setOpenCollection] = useState(false);
    const [openSearchCollections, setOpenSearchCollections] = useState(false);
    const [openHistory, setOpenHistory] = useState(false);
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [darkTheme, setDarkTheme] = useState(localStorage.getItem('darkTheme') === 'true');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [currentCountUploading, setCurrentCountUploading] = useState(0);
    const auth = useAuth();
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [isLoadingCollections, setIsLoadingCollections] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [message, messageContextHolder] = Message.useMessage();
    const [modal, contextHolder] = Modal.useModal();
    const isMounted = useRef<boolean>(false);

    const onRefreshToken = async () => {
        const renewedUser = await auth.signinSilent();
        if (renewedUser) {
            console.log('Refresh expired token');
            await setTokenAuth(renewedUser.access_token);
            await apiClient.updateToken(renewedUser.access_token);
        } else {
            await auth.removeUser();
            modal.info({
                title: "Сессия завершена",
                centered: true,
                content: 'Сессия устарела или недействительна. Авторизуйтесь заново!',
                onOk: () => auth.signinRedirect(),
            });
        }
    }

    const onUserLoaded = async (user: User | null) => {
        if (user && !user.expired) {
            console.log('Refresh expiring token');
            await setTokenAuth(user.access_token);
            await apiClient.updateToken(user.access_token);
        }
    }

    if (!isMounted.current) {
        auth.events.addAccessTokenExpired(onRefreshToken);
        auth.events.addUserLoaded(onUserLoaded);
        isMounted.current = true;
    }

    useEffect(() => {
        if (auth.user && !auth.user.expired) {
            login(auth.user.access_token);
        }
    }, [auth.isAuthenticated]);

    const getFiles = async (collection: Collection) => {
        setIsLoading(true);
        const response = await apiClient.getFiles(collection.id);
        setIsLoading(false);
        if (response.status === 200) {
            if (response.data.length > 0) {
                setFiles(response.data);
            } else {
                setFiles([{}]);
            };
        } else if (response.status === 410) {
            setFiles([{}]);
            modal.error({
                title: "Фатальная ошибка!",
                centered: true,
                content: 'Коллекция не существует, данные утеряны!\nПожалуйста удалите коллекцию через меню "Управление" или обратитесь в службу поддержки!'
            });
        } else {
            setFiles([{}]);
            modal.error({
                title: "Ошибка сервера",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        }
    };

    async function updateCollection(collection_id: number, path: string = '') {
        if (currentBucket !== null && collection_id === currentBucket.id) {
            const response = await apiClient.getFiles(currentBucket.id, path);
            if (response.status === 200) {
                if (response.data.length > 0) {
                    setFiles(response.data);
                } else {
                    setFiles([{}]);
                };
            }
        }
    };

    async function getCollections(isResetCurrentCollection: boolean = false): Promise<Collection[]> {
        setIsLoadingCollections(true);
        let result = [];
        const response = await apiClient.getCollections();
        let responseFree = null;
        const freeCollectionIds = localStorage.getItem('freeCollectionIds');
        if (freeCollectionIds && freeCollectionIds.length > 2) {
            responseFree = await apiClient.getFreeCollections(JSON.parse(freeCollectionIds));
        }
        setIsLoadingCollections(false);
        if (response.status === 200) {
            result = response.data;
            if (responseFree !== null && responseFree.status === 200) {
                result = result.concat(responseFree.data);
            }
            if (result.length > 0) {
                if (currentBucket === null || isResetCurrentCollection) {
                    setCurrentBucket(result[0]);

                    if (currentPath !== null) {
                        navigate(`${filesEndpoint}/${result.id}/`);
                    }
                }
                if (isResetCurrentCollection) {
                    getFiles(result[0]);
                }
            }
        } else if (response.status === 500) {
            modal.error({
                title: "Ошибка сервера",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        } else if (response.status === 401) {
            modal.error({
                title: "Неавторизован",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        } else if (response.status === 0) {
            modal.error({
                title: "Нет ответа от сервера",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        }
        setBuckets(result);
        return result;
    }

    // Refresh Files
    const handleRefresh = () => {
        currentBucket !== null && getFiles(currentBucket);
    };

    const handleDownload = async (files: File[]) => {
        currentBucket !== null && await apiClient.downloadFile(files, currentBucket.id);
    };

    // File Upload Handlers
    const handleFileUploading = (_: File, parentFolder: File) => {
        return { bucket: currentBucket!.name, path: parentFolder !== null ? parentFolder.path : '/' };
    };

    const handleFileUploaded = async (response: any) => {
        console.log(response);
        // const uploadedFile = JSON.parse(response);
        // setFiles((prev) => [...prev, uploadedFile]);
        currentBucket !== null && await getFiles(currentBucket);
    };

    const handleError = (error: any, _: File) => {
        console.error(error);
    };

    // Delete File/Folder
    const handleDelete = async (files: File[]) => {
        setIsLoading(true);
        const response = await apiClient.deleteFiles(currentBucket!.id, files);
        setIsLoading(false);
        if (response.status === 200) {
            currentBucket !== null && await getFiles(currentBucket);
            message.success(`Успешно удалено`);
        } else if (response.status === 500) {
            modal.error({
                title: "Ошибка сервера",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        } else {
            message.error('Произошла ошибка! ' + response);
        }
    };

    const handleRename = async (file: File, newName: string) => {
        setIsLoading(true);
        const response = await apiClient.rename(file.isDirectory ? file.path + '/' : file.path, newName, currentBucket!.id);
        setIsLoading(false);
        if (response.status === 200) {
            currentBucket !== null && await getFiles(currentBucket);
            message.success(`Успешно переименовано`);
        } else if (response.status === 500) {
            modal.error({
                title: "Ошибка сервера",
                centered: true,
                content: 'Попробуйте авторизоваться заново или обратитесь в службу поддержки!'
            });
        } else {
            message.error('Произошла ошибка! ' + response);
        }
        currentBucket !== null && await getFiles(currentBucket);
    };

    // Create Folder
    const handleCreateFolder = async (name: string, parentFolder: File) => {
        setIsLoading(true);
        const response = await apiClient.createFolder(name, parentFolder !== null ? parentFolder.path : '/', currentBucket!.id);
        if (response.status === 200 || response.status === 201) {
            currentBucket !== null && await getFiles(currentBucket);
            message.success(`Папка "${name}" создана`);
        } else {
            message.error('Произошла ошибка! ' + response);
        }
        setIsLoading(false);
    };

    function handleCopy(_: File[]) {
        copyCollection.current = currentBucket;
        message.success('Готово к вставке');
    }

    function handleFolderChange(path: string) {
        setCurrentPath(path);
        navigate(`${filesEndpoint}/${currentBucket?.id}/${path}/`);
    }

    const handlePaste = async (copiedItems: File[], destinationFolder: File, operationType: string) => {
        let copiedFiles = [];
        for (const file of copiedItems) {
            if (file.isDirectory) {
                copiedFiles.push(file.path + '/');
            } else {
                copiedFiles.push(file.path);
            }
        }
        if (operationType === "copy" && copyCollection.current !== null && currentBucket !== null) {
            setIsLoading(true);
            const response = await apiClient.copyFiles(copyCollection.current.id, copiedFiles, currentBucket.id, destinationFolder !== null ? destinationFolder.path : '/');
            setIsLoading(false);
            if (response.status === 200) {
                message.success('Файлы успешно скопированы');
                await getFiles(currentBucket);
            } else if (response.status === 403) {
                message.error('Нет прав на копирование');
            } else {
                message.error('Произошла ошибка! ' + response);
            }
        }
    };

    const changeCollection = async (id: number, collections: Collection[] | null = null) => {
        let collection;
        if (collections !== null) {
            collection = collections.find(item => item.id === id);
        } else {
            collection = buckets.find(item => item.id === id);
        }
        try {
            const query = document.querySelector('.breadcrumb-file-path .ant-breadcrumb-link span');
            if (query !== null) {
                (query as HTMLSpanElement).click();
            }
        } catch (error) {
            console.error(error);
        }

        if (!collection && id) {
            const response = await apiClient.getFreeCollections([id]);
            if (response.status === 200) {
                const collectionsFree: Collection[] = response.data;
                if (collectionsFree.length > 0) {
                    collection = collectionsFree[0];
                    if (collections !== null) {
                        setBuckets(collectionsFree.concat(collections));
                    } else {
                        setBuckets(collectionsFree.concat(buckets));
                    }
                }
            }
        }

        if (collection) {
            setCurrentBucket(collection);
            if (currentPath !== null) {
                navigate(`${filesEndpoint}/${collection.id}/`);
            }
            await getFiles(collection);
        }
    }

    const outAccount = async () => {
        await auth.signoutRedirect();
        setShowControlPanel(false);
        navigate('');
        setTokenAuth(null);
        setBuckets([]);
        setCurrentBucket(null);
        setFiles([{}]);
    };

    const handleOkCreateCollection = async () => {
        setIsCreatingCollection(true);
        let response = await apiClient.createCollection(newCollectionName);
        if (response.status === 200) {
            setIsModalOpen(false);
            message.success('Коллекция успешно создана');
            const collections = await getCollections();
            setNewCollectionName('');
            await changeCollection(response.data, collections);
        } else if (response.status === 406) {
            message.error('Имя может содержать только латинские буквы и цифры');
        } else if (response.status === 409) {
            message.error('Коллекция с таким именем уже существует в системе');
        } else {
            message.error('Произошла ошибка! ' + response);
        }
        setIsCreatingCollection(false);
    };

    const handleProperties = async (file: File) => {
        let response = await apiClient.getFileInfo(currentBucket!.id, file['path'], file['isDirectory']);
        if (response.status === 200) {
            if (response.data !== null) {

                modal.info({
                    title: "Свойства" + (file['isDirectory'] ? ' папки ' : ' файла ') + file['name'],
                    icon: null,
                    centered: true,
                    content: <FileProperties properties={response.data} />,
                    okText: 'Закрыть'
                });
            } else {
                modal.confirm({
                    title: "Свойства " + file['name'],
                    centered: true,
                    content: "Файл не индексирован",
                    cancelText: 'Закрыть',
                    okText: 'Индексировать',
                    onOk: async () => {
                        let response = await apiClient.indexFile(currentBucket!.id, file['path']);
                        if (response.status === 200) {
                            handleProperties(file);
                        } else {
                            message.error('Не удалость индексировать файл')
                        }
                    }
                });
            }
        } else {
            message.error('Произошла ошибка! ' + response);
        }
    };

    function getCollectionItems() {
        const ownerItems = [];
        const accessItems = [];
        const groupItems = [];
        const accessToAllItems = [];
        const collections: Collection[] = buckets;

        for (let i = 0; i < collections.length; i++) {
            const item = {
                label: collections[i].name || collections[i].id,
                value: collections[i].id,
            };

            switch (collections[i].type) {
                case 'owner': ownerItems.push(item); break;
                case 'access': accessItems.push(item); break;
                case 'group': groupItems.push(item); break;
                case 'access_to_all': accessToAllItems.push(item); break;
            }
        }

        const result = [];
        if (ownerItems.length > 0) {
            result.push({ label: 'Вы владелец', options: ownerItems });
        }
        if (accessItems.length > 0) {
            result.push({ label: 'Получен доступ', options: accessItems });
        }
        if (groupItems.length > 0) {
            result.push({ label: 'Групповые', options: groupItems });
        }
        if (accessToAllItems.length > 0) {
            result.push({ label: 'Для всех', options: accessToAllItems });
        }

        return result;
    }

    const items: any[] = [
        {
            key: 'fileManager',
            label: 'Файловый менеджер',
            icon: <img height='40px' width='40px' src={'/favicon.svg'} />,
        },
        {
            type: 'divider',
        },
        {
            key: 'search',
            label: 'Поиск',
            icon: <SearchOutlined />,
        },
        {
            key: 'profile',
            label: 'Профиль',
            icon: <UserOutlined />,
        },
        {
            key: 'groups',
            label: 'Группы',
            icon: <TeamOutlined />,
        },
        {
            type: 'divider',
        },
        {
            key: 'logs',
            label: 'Логи',
            icon: <HistoryOutlined />,
        },
        {
            type: 'divider',
        },
        {
            key: 'theme',
            label: 'Переключить тему',
            icon: <SunOutlined />,
        },
        {
            type: 'divider',
        },
        {
            key: 'exit',
            label: 'Выход',
            icon: <LogoutOutlined />,
        },
    ];

    function onClickLogin(e: any) {
        switch (e.key) {
            case 'fileManager':
                setShowControlPanel(false);
                break;
            case 'search':
                setOpenSearchCollections(true);
                break;
            case 'profile':
                setOpenProfile(true);
                break;
            case 'groups':
                setShowControlPanel(true);
                break;
            case 'logs':
                setOpenLogs(!openLogs);
                break;
            case 'theme':
                localStorage.setItem('darkTheme', (!darkTheme).toString());
                setDarkTheme(!darkTheme);
                break;
            case 'exit':
                outAccount();
                break;
        }
    }

    async function login(token: string) {
        setTokenAuth(token);
        apiClient.updateToken(token);
        const segments = decodeURIComponent(location.pathname).split('/').filter(Boolean);
        const collections = await getCollections(true);
        setIsLoadingCollections(true);
        if (segments[0] === filesEndpoint) {
            await changeCollection(Number(segments[1]), collections);
            const folder = segments.slice(2).join('/');
            await setCurrentPath('/' + folder);
        } else {
            await changeCollection(0, collections);
            await setCurrentPath('/');
        }
        setIsLoadingCollections(false);
    }

    const permissions = [
        { create: true, upload: true, move: false, copy: true, rename: true, download: true, delete: true }, // owner
        { create: true, upload: true, move: false, copy: true, rename: true, download: true, delete: true }, // readwrite
        { create: false, upload: false, move: false, copy: true, rename: false, download: true, delete: false }, // readonly
        { create: true, upload: true, move: false, copy: false, rename: false, download: false, delete: false }, // writeonly
    ]

    let page = <></>;
    if (!tokenAuth) {
        page = <AuthPage />;
    } else {
        page = <>
            <Modal
                title="Создание коллекции"
                open={isModalOpen}
                onOk={handleOkCreateCollection}
                onCancel={
                    () => {
                        setIsModalOpen(false);
                        setNewCollectionName('');
                    }
                }
                okButtonProps={{ disabled: newCollectionName.length < 3, loading: isCreatingCollection }}
            >
                <p>Имя коллекции</p>
                <Input placeholder="Имя" value={newCollectionName} count={{ show: true, max: 63 }} onChange={(e) => setNewCollectionName(e.target.value)} />
            </Modal>
            {buckets.length > 0 && currentPath !== null ?
                <Suspense fallback={
                    <Flex className='not-collections' style={{ height: 'calc(100vh - 38px - 70px)' }} justify="center" align="center">
                        <Spin size='large' />
                    </Flex>
                }>
                    <FileManager
                        files={files}
                        language='ru'
                        isLoading={isLoading}
                        layout={'list'}
                        onRefresh={handleRefresh}
                        onError={handleError}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onCopy={handleCopy}
                        onPaste={handlePaste}
                        onRename={handleRename}
                        onShowProperties={handleProperties}
                        onFileUploading={handleFileUploading}
                        onFileUploaded={handleFileUploaded}
                        onCreateFolder={handleCreateFolder}
                        fileUploadConfig={{ url: url, method: 'PUT' }}
                        defaultNavExpanded={!window.matchMedia('(pointer:coarse)').matches}
                        collapsibleNav={true}
                        filePreviewPath={url + `/collections/${currentBucket?.id}/files/?token=${tokenAuth}`}
                        primaryColor='#1677ff'
                        permissions={currentBucket !== null ? permissions[currentBucket.access_type_id - 1] : permissions[0]}
                        onFolderChange={handleFolderChange}
                        initialPath={currentPath}
                    />
                </Suspense> :
                <Flex className='not-collections' style={{ height: 'calc(100vh - 38px - 70px)' }} justify="center" align="center">
                    {isLoadingCollections ? <Spin size='large' /> : <Result
                        title="У вас нет доступных коллекций, но вы можете их создать!"
                        extra={
                            <Button type="primary" onClick={() => setIsModalOpen(true)}>Создать коллекцию</Button>
                        }
                    />}
                </Flex>
            }
        </>;
    }

    const searchButton = <Tooltip title='Поиск коллекций'><Button className='search-button' icon={<SearchOutlined />} onClick={() => setOpenSearchCollections(true)} /></Tooltip>;

    return <ConfigProvider locale={ruRU} theme={{
        components: { Layout: { headerBg: '#00000000' } },
        algorithm: darkTheme ? theme.darkAlgorithm : undefined,
    }}>
        <AntApp>
            {contextHolder}
            {messageContextHolder}
            <Layout>
                {tokenAuth && <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0px 10px 0px 0px' }}>
                    <Button type='text' style={{ height: 60, padding: 10, }} className='header-right' onClick={() => onClickLogin({ key: 'fileManager' })}>
                        <img height='40px' width='40px' src={'/favicon.svg'} />
                        <h1>Хранилище</h1>
                    </Button>
                    <Space className='header-left'>
                        {
                            buckets.length > 0 ? <>
                                {currentBucket !== null && ['', <Tag color='purple'>Чтение и запись</Tag>, <Tag color='orange'>Только чтение</Tag>, <Tag color='magenta'>Только запись</Tag>][currentBucket.access_type_id - 1]}
                                <Select prefix="Коллекция" style={{ width: '200px' }} value={currentBucket?.id} onChange={(id) => changeCollection(id)} options={getCollectionItems()} />
                                <Tooltip title='Создать коллекцию'>
                                    <Button icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)} />
                                </Tooltip>
                                {currentBucket !== null && currentBucket.type === 'owner' && <Tooltip title='История'><Button icon={<HistoryOutlined />} onClick={() => setOpenHistory(true)} /></Tooltip>}
                                <Tooltip title='Управление коллекцией'>
                                    <Button icon={<SettingOutlined />} onClick={() => setOpenCollection(true)} />
                                </Tooltip>
                                {searchButton}
                                <FloatButton {...{ id: 'upload-button' }} type='primary' badge={{ count: currentCountUploading, overflowCount: 9999 }} icon={<UploadOutlined />} onClick={() => setOpenUploader(true)} tooltip='Загрузки' />
                            </> : searchButton
                        }
                        <Dropdown trigger={['click']} menu={{ items, onClick: onClickLogin }}>
                            <Button iconPlacement='end' type="primary" shape="round" icon={<UserOutlined />}>
                                {auth.user?.profile.preferred_username}
                            </Button>
                        </Dropdown>
                    </Space>
                    {currentBucket !== null && <History collection_id={currentBucket.id} open={openHistory} setOpen={setOpenHistory} />}
                    <Logs open={openLogs} setOpen={setOpenLogs} />
                    <Groups open={showControlPanel} setOpen={setShowControlPanel} getCollections={getCollections} />
                    <Drawer size='large' open={openCollection} onClose={() => setOpenCollection(false)}>
                        {openCollection && <CollectionPage collection={currentBucket!} getCollections={getCollections} open={openCollection} setOpen={setOpenCollection} />}
                    </Drawer>
                    <Drawer title='Профиль' size='large' open={openProfile} onClose={() => setOpenProfile(false)}>
                        {openProfile && <ProfilePage token={tokenAuth} />}
                    </Drawer>
                    <Drawer title='Поиск коллекций' size={1080} open={openSearchCollections} onClose={() => setOpenSearchCollections(false)}>
                        {openSearchCollections && <CollectionsSearch getCollections={getCollections} />}
                    </Drawer>
                </Layout.Header>}
                <Layout.Content>
                    <Card className='main-card' style={{ margin: '0 10px' }} styles={{ body: { padding: 0 } }}>
                        {page}
                    </Card>
                    <Uploader open={openUploader} setOpen={setOpenUploader} url={url} collection_id={currentBucket !== null ? currentBucket.id : null} path={currentPath} token={tokenAuth} updateCollection={updateCollection} setCurrentCountUploading={setCurrentCountUploading} />
                </Layout.Content>
                <Layout.Footer style={{ padding: '10px 50px', textAlign: 'center', color: 'grey' }}>storage-web © 2026 Created by Denis Mazur</Layout.Footer>
            </Layout>
        </AntApp>
    </ConfigProvider>
}

export default App