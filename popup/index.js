function getVideoInfo() {
    const iframe = document.querySelector('#tool_content');
    const root = iframe.contentWindow.document.querySelector('#root');
    const videoIframe = root.querySelector('div > div.xnlail-video-component > div.xnlailvc-commons-container > iframe');
    if (!videoIframe) return null;

    const videoSrc = videoIframe.getAttribute('src');                   // videoSrc ex) https://commons.ssu.ac.kr/em/69bd616f92eb6?startat=0.00&endat=0.00&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F794113%2Fprogress%3Fuser_id%3D20222904%26content_id%3D69bd616f92eb6%26content_type%3Dmovie&sl=1&pr=1&mxpr=1.00&lg=ko
    const targetUrl = new URL(videoSrc).searchParams.get('TargetUrl');  // targetUrl ex) https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794113/progress?user_id=20222904&content_id=69bd616f92eb6&content_type=movie
    const courseId = root.getAttribute('data-course_id');
    const itemId = root.getAttribute('data-item_id');
    const xn_api_token = document.cookie.split('xn_api_token=').at(1)?.split(';')?.at(0);

    return { targetUrl, courseId, itemId, xn_api_token };
}

document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.getElementById('mainContent');
    const errorContent = document.getElementById('errorContent');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('canvas.ssu.ac.kr')) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getVideoInfo
    });
    const info = results[0].result;
    
    if (!info) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }

    sendMessageToBackground('get-video-progress', info);

    document.getElementById('completeBtn').addEventListener('click', () => {
        if (document.getElementById('completionStatus').textContent.includes('완료')
            && !confirm('이미 학습이 완료되었습니다. 그럼에도 실행하시겠습니까?')) return;
        sendMessageToBackground('complete-video-progress', info);
    });
});


chrome.runtime.onMessage.addListener((message) => {
    console.log(message);
    if (message.target !== 'popup') return;

    switch (message.type) {
        case 'set-video-progress': {
            const percent = message.data.percent;
            if (!percent || typeof percent !== 'number') {
                console.warn(`percent is not valid: ${percent}`);
                break;
            }
            const bar = document.getElementById('progressBar');
            const text = document.getElementById('percentText');
            const statusBadge = document.getElementById('completionStatus');
            bar.style.width = percent + '%';
            text.textContent = percent + '%';
            if (message.data.is_completed) {
                statusBadge.textContent = '학습 완료';
                statusBadge.style.backgroundColor = '#E8F5E9'; // 연한 초록 배경
                statusBadge.style.color = '#2E7D32';         // 진한 초록 글씨
            } else {
                statusBadge.textContent = '미완료';
                statusBadge.style.backgroundColor = '#FFF3E0'; // 연한 주황 배경
                statusBadge.style.color = '#EF6C00';         // 진한 주황 글씨
            }
            break;
        }
        case 'complete-video-progress-error': {
            alert(`오류가 발생했습니다.\nmessage: ${message.data.errorMessage}, time: ${message.data.time}, delta: ${message.data.delta}`);
            break;
        }
    }
});

function sendMessageToBackground(type, data) {
    chrome.runtime.sendMessage({target: 'background', type, data});
}