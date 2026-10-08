function trustedWindow(getWindow, appUrl) {
    const window = getWindow();
    if (!window || window.isDestroyed() || !window.webContents.mainFrame
        || window.webContents.mainFrame.url.split('#')[0] !== appUrl.split('#')[0]) throw new Error('Untrusted desktop sender');
    return window;
}

function authorizeSender(event, getWindow, appUrl) {
    const window = trustedWindow(getWindow, appUrl);
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted desktop sender');
    return window;
}

module.exports = { authorizeSender, trustedWindow };
