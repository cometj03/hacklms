function sanitizeFilename(name) {
    return (name || 'video')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || 'video';
}

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
    document.querySelector('h3').textContent = `Hack LMS v${chrome.runtime.getManifest().version}`;
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
    const { title: videoTitle, targetUrl, contentId, courseId, itemId } = info;


    // 동영상 정보 표시
    document.getElementById('videoTitle').textContent = videoTitle || '제목 없음';

    // 동영상 URL 가져오기 및 표시
    // background의 webRequest listener가 캐시한 mp4 URL을 조회
    // 파일명/경로가 다양함 (screen.mp4, main_(uuid).mp4 / contents, contents31, ssu-toast vs ssuin-object 등)
    // 캐시 비어있으면 autoplay 트리거 후 일정시간 polling
    const videoUrlElement = document.getElementById('videoUrl');
    const downloadBtn = document.getElementById('downloadBtn');

    let videoUrl = await getCapturedMp4(tab.id);
    if (!videoUrl) {
        videoUrlElement.textContent = '영상 URL 캡처 중...';
        videoUrlElement.style.color = '#999';
        downloadBtn.disabled = true;
        downloadBtn.textContent = '대기 중...';
        try {
            await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'trigger-autoplay' });
        } catch (e) { /* iframe missing — handled below */ }
        const start = Date.now();
        while (Date.now() - start < 8000) {
            await new Promise(r => setTimeout(r, 300));
            videoUrl = await getCapturedMp4(tab.id);
            if (videoUrl) break;
        }
    }

    if (videoUrl) {
        videoUrlElement.textContent = videoUrl;
        downloadBtn.disabled = false;
        downloadBtn.addEventListener('click', async () => {
            const originalText = downloadBtn.textContent;
            const filename = `${sanitizeFilename(videoTitle)}.mp4`;

            // Step 1: 클릭 즉시 user-gesture 상태에서 saveFilePicker 호출
            let handle = null;
            if ('showSaveFilePicker' in window) {
                try {
                    handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'MP4 Video',
                            accept: { 'video/mp4': ['.mp4'] }
                        }]
                    });
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    alert(`저장 위치 선택 실패: ${err.message}`);
                    return;
                }
            }

            downloadBtn.disabled = true;
            try {
                downloadBtn.textContent = '다운로드 시작... (창 닫지 마세요)';
                const res = await fetch(videoUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const total = Number(res.headers.get('content-length')) || 0;
                const updateProgress = (received) => {
                    downloadBtn.textContent = total
                        ? `다운로드 중 ${Math.floor(received / total * 100)}%...`
                        : `다운로드 중 ${Math.floor(received / 1024 / 1024)} MB...`;
                };

                if (handle) {
                    // Step 2: 스트리밍으로 디스크에 직접 쓰기 (메모리 효율)
                    const writable = await handle.createWritable();
                    const reader = res.body.getReader();
                    let received = 0;
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            await writable.write(value);
                            received += value.length;
                            updateProgress(received);
                        }
                        await writable.close();
                        downloadBtn.textContent = '완료';
                    } catch (err) {
                        await writable.abort();
                        throw err;
                    }
                } else {
                    // Fallback: showSaveFilePicker 미지원
                    const chunks = [];
                    let received = 0;
                    const reader = res.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        received += value.length;
                        updateProgress(received);
                    }
                    const blob = new Blob(chunks, { type: 'video/mp4' });
                    const objectUrl = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: objectUrl,
                        filename,
                        saveAs: true
                    }, () => setTimeout(() => URL.revokeObjectURL(objectUrl), 60000));
                }
            } catch (err) {
                alert(`다운로드 실패: ${err.message}`);
            } finally {
                downloadBtn.disabled = false;
                downloadBtn.textContent = originalText;
            }
        });
        downloadBtn.textContent = '동영상 다운로드';
    } else {
        videoUrlElement.textContent = '영상 URL을 잡지 못했습니다. 페이지에서 영상을 한 번 재생한 뒤 popup을 다시 열어주세요.';
        videoUrlElement.style.cursor = 'default';
        videoUrlElement.style.color = '#999';
        videoUrlElement.style.textDecoration = 'none';
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'URL 없음';
    }

    sendMessageToBackground('get-video-progress', {courseId, itemId, xn_api_token: token});

    document.getElementById('completeBtn').addEventListener('click', () => {
        // TODO: 경고 멘트 추가
        if (document.getElementById('completionStatus').textContent.includes('학습 완료')
            && !confirm('이미 학습이 완료되었습니다. 그럼에도 실행하시겠습니까?')) return;
        sendMessageToBackground('complete-video-progress', {
            targetUrl,
            courseId,
            itemId,
            xn_api_token: token
        });
    });

    // 배속 조절 이벤트
    const speedSlider = document.getElementById('playbackSpeed');
    const speedValue = document.getElementById('speedValue');
    const {playbackRate} = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'get-video-playback-rate' });
    speedSlider.value = playbackRate || 1.0;
    speedValue.textContent = playbackRate + 'x';
    speedSlider.addEventListener('input', () => {
        speedValue.textContent = speedSlider.value + 'x';
    });
    speedSlider.addEventListener('change', async (e) => {
        const newSpeed = parseFloat(e.target.value);
        const {success, errorMessage} = await chrome.tabs.sendMessage(tab.id, { target: 'video-iframe', type: 'set-video-playback-rate', data: { playbackRate: newSpeed } });
        if (!success) {
            alert(`배속 조절 오류: ${errorMessage}`);
        }
    });
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
        default:
            console.warn('popup received message with unknown type:', message);
            break;
    }
});

function sendMessageToBackground(type, data) {
    chrome.runtime.sendMessage({target: 'background', type, data});
}

function getCapturedMp4(tabId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { target: 'background', type: 'get-captured-mp4', data: { tabId } },
            (resp) => resolve(resp?.videoUrl ?? null)
        );
    });
}