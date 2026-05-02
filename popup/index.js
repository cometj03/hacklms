function getToken() {
    const token = document.cookie.split('xn_api_token=').at(1)?.split(';')?.at(0);
    if (!token) {
        // TODO: error handling
        console.warn('getToken: token not found in cookies');
        return null;
    }
    return token;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelector('h3').textContent = `Hack LMS v${chrome.runtime.getVersion()}`;
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
        func: getToken
    });
    const token = results[0].result;

    let info = null;
    try {
        info = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'get-video-info' });
    } catch (error) {
        // 메시지 리스너가 video iframe에 달려있기 때문에 리스너가 없는 경우(즉 video iframe이 없는 경우) 에러가 발생함.
        // 다시 말해 비디오 강의가 아니라는 의미
        // Do nothing
    }
    if (!info) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }


    // 동영상 정보 표시
    document.getElementById('videoTitle').textContent = info.title || '제목 없음';

    // 동영상 URL 가져오기 및 표시
    // videoUrl ex) 'https://ssuin-object.commonscdn.com/ssu-contents/contents/ssu1000001/65c09c6666b2b/contents/media_files/screen.mp4'
    // 경로가 contents인 경우도 있고 contents31인 경우도 있어서 contentId로만 url을 만들 수 없음
    const {videoUrl} = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'get-video-url' });

    const videoUrlElement = document.getElementById('videoUrl');
    const downloadBtn = document.getElementById('downloadBtn');
    if (videoUrl) {
        videoUrlElement.textContent = videoUrl;
        downloadBtn.disabled = false;
        downloadBtn.addEventListener('click', () => {
            chrome.downloads.download({
                url: videoUrl,
                filename: `${info.title}.mp4`,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    alert(`다운로드 오류: ${chrome.runtime.lastError.message}`);
                }
            });
        });
        downloadBtn.textContent = '동영상 다운로드';
    } else {
        videoUrlElement.style.cursor = 'default';
        videoUrlElement.style.color = '#999';
        videoUrlElement.style.textDecoration = 'none';
        downloadBtn.disabled = true;
    }

    sendMessageToBackground('get-video-progress', {...info, xn_api_token: token});

    document.getElementById('completeBtn').addEventListener('click', () => {
        if (document.getElementById('completionStatus').textContent.includes('학습 완료')
            && !confirm('이미 학습이 완료되었습니다. 그럼에도 실행하시겠습니까?')) return;
        sendMessageToBackground('complete-video-progress', {...info, xn_api_token: token});
    });

    // 배속 조절 이벤트
    // document.getElementById('playbackSpeed').addEventListener('change', (e) => {
    //     const speed = parseFloat(e.target.value);
    //     sendMessageToBackground('set-playback-speed', { ...info, speed });
    // });
});

function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const rounded = Math.floor(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

chrome.runtime.onMessage.addListener((message) => {
    console.log('popup received message:', message);
    if (message.target !== 'popup') return;

    switch (message.type) {
        case 'set-video-progress': {
            const percent = message.data.percent;
            const bar = document.getElementById('progressBar');
            const text = document.getElementById('percentText');
            const statusBadge = document.getElementById('completionStatus');
            bar.style.width = percent + '%';
            text.textContent = percent.toFixed(2) + '%';
            if (message.data.is_completed) {
                statusBadge.textContent = '학습 완료';
                statusBadge.style.backgroundColor = '#E8F5E9';
                statusBadge.style.color = '#2E7D32';
            } else {
                statusBadge.textContent = '미완료';
                statusBadge.style.backgroundColor = '#FFF3E0';
                statusBadge.style.color = '#EF6C00';
            }

            if (typeof message.data.duration === 'number') {
                document.getElementById('videoLength').textContent = formatSeconds(message.data.duration);
            }
            if (typeof message.data.progress === 'number') {
                document.getElementById('watchedLength').textContent = formatSeconds(message.data.progress);
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