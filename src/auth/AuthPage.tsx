import { useEffect } from 'react';
import { Button, Spin, Result } from 'antd';
import { useAuth } from 'react-oidc-context';
import './AuthPage.css';

function AuthPage() {
    const auth = useAuth();

    useEffect(() => {
        if (auth.error?.message === "No matching state found in storage") {
            auth.signinRedirect();
        }
    }, [auth.error?.message, auth.signinRedirect]);

    function getCookie(name: string) {
        const cookies = document.cookie.split('; ');

        for (let cookie of cookies) {
            const [key, value] = cookie.split('=');
            if (key === name) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    let body: React.JSX.Element;
    if (auth.isAuthenticated) {
        body = <Spin description="Идет процесс входа" size='large' />;
        const sid = getCookie('sid');
        if (!sid) {
            auth.removeUser();
        } else if (sid !== auth.user?.profile.sid) {
            auth.signinSilent();
        }
    } else if (auth.isLoading || auth.user && auth.user.expired) {
        body = <Spin description="Идет процесс входа" size='large' />;
    } else {
        if (getCookie('sid')) {
            body = <Spin description="Идет процесс входа" size='large' />;
            auth.signinSilent();
        } else {
            body = <Result
                title="Требуется вход в учетную запись"
                extra={
                    <Button style={{ width: '100%' }} type='primary' onClick={() => auth.signinRedirect()}>Войти</Button>
                }
            />;
        }
    }

    if (auth.error) {
        body = <Result
            status="error"
            title={`${auth.error.name}: ${auth.error.message}`}
            subTitle="Попробуйте перезагрузить страницу!"
        />;
    }

    return (
        <div className='auth-page'>
            {body}
        </div>
    );
}

export default AuthPage;