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

    const info = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'get-video-info' });
    console.log('popup info:', info);
    if (!info) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }

    // 동영상 정보 표시
    document.getElementById('videoTitle').textContent = info.title;
    
    // 동영상 URL 가져오기 및 표시
    // videoUrl ex) 'https://ssuin-object.commonscdn.com/ssu-contents/contents/ssu1000001/65c09c6666b2b/contents/media_files/screen.mp4'
    // 경로가 contents인 경우도 있고 contents31인 경우도 있어서 contentId로만 url을 만들 수 없음
    const {videoUrl} = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'get-video-url' });
    const videoUrlElement = document.getElementById('videoUrl');
    if (videoUrl) {
        videoUrlElement.textContent = videoUrl;
        videoUrlElement.addEventListener('click', () => {
            chrome.downloads.download({
                url: videoUrl,
                filename: `${info.title}.mp4`,
                saveAs: true // 사용자가 저장 위치를 선택하게 함
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    alert(`다운로드 오류: ${chrome.runtime.lastError.message}`);
                }
            });
        });
    } else {
        videoUrlElement.textContent = '동영상이 아직 로드되지 않았습니다. 인트로가 끝난 후 다시 시도해주세요.';
        videoUrlElement.style.cursor = 'default';
        videoUrlElement.style.color = '#999';
        videoUrlElement.style.textDecoration = 'none';
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


chrome.runtime.onMessage.addListener((message) => {
    console.log(message);
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