import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModelConsentManager, modelConsentManager } from './modelConsent';

export interface LicenseModalProps {
    modelId: string;
    modelName: string;
    license: string | undefined;
    termsUrl?: string;
    estimatedDownloadMB?: number;
}

export function showLicenseModal(props: LicenseModalProps): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof document === 'undefined') return resolve(false);

        const container = document.createElement('div');
        container.style.zIndex = '9999';
        document.body.appendChild(container);

        const handleClose = (accepted: boolean) => {
            try { root.unmount(); } catch {}
            if (container.parentNode) container.parentNode.removeChild(container);
            resolve(accepted);
        };

        const Modal: React.FC = () => {
            const onAccept = () => handleClose(true);
            const onDecline = () => handleClose(false);

            return (
                React.createElement('div', { style: modalOverlay },
                    React.createElement('div', { style: modalCard },
                        React.createElement('h2', null, `License Agreement — ${props.modelName}`),
                        React.createElement('p', null, `This model is provided under the '${props.license}' license.`),
                        props.termsUrl ? React.createElement('p', null, React.createElement('a', { href: props.termsUrl, target: '_blank', rel: 'noreferrer' }, 'View full terms')) : null,
                        props.estimatedDownloadMB ? React.createElement('p', null, `Estimated download size: ${props.estimatedDownloadMB} MB`) : null,
                        React.createElement('div', { style: buttonRow },
                            React.createElement('button', { onClick: onDecline, style: declineButton }, 'Decline'),
                            React.createElement('button', { onClick: onAccept, style: acceptButton }, 'Accept')
                        )
                    )
                )
            );
        };

        const root = createRoot(container);
        root.render(React.createElement(Modal));
    });
}

const modalOverlay: React.CSSProperties = {
    position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const modalCard: React.CSSProperties = {
    width: 'min(640px, 92%)', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
};

const buttonRow: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px' };
const acceptButton: React.CSSProperties = { background: '#0b74ff', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' };
const declineButton: React.CSSProperties = { background: '#eee', color: '#111', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' };
