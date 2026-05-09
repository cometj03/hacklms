function getVideoInfo() {
    // window.location.href ex) https://commons.ssu.ac.kr/em/69bd616f92eb6?startat=0.00&endat=0.00&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F794113%2Fprogress%3Fuser_id%3D20222904%26content_id%3D69bd616f92eb6%26content_type%3Dmovie&sl=1&pr=1&mxpr=1.00&lg=ko
    // targetUrl            ex) https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794113/progress?user_id=20222904&content_id=69bd616f92eb6&content_type=movie
    const targetUrl = new URL(window.location.href).searchParams.get('TargetUrl');
    const contentId = new URL(targetUrl).searchParams.get('content_id');    // contentId ex) 69bd616f92eb6
    const courseId = targetUrl.split('/courses/')[1].split('/')[0];         // courseId ex) 44036
    const itemId = targetUrl.split('/components/')[1].split('/')[0];        // itemId ex) 794113
    
    if (!targetUrl || !contentId || !courseId || !itemId) {
        console.warn('getVideoInfo: required video info not found in URL', {targetUrl, contentId, courseId, itemId});
        return null;
    }
    const title = document.querySelector('title')?.textContent?.trim();

    return { title, targetUrl, contentId, courseId, itemId };
}

const VIDEO_SELECTOR = '#video-play-video1 > div.vc-vplay-container.non-selectable > video';

// ratechange 이벤트가 전파되지 않도록 막는 가드 함수
const guard = (e) => { e.stopImmediatePropagation(); };

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.target !== 'video-iframe') return;
    switch (message.type) {
        case "get-video-info": {
            const info = getVideoInfo();
            if (info) {
                sendResponse(info);
            }
            break;
        }
        case "get-video-url": {
            const videoUrl = document.querySelector(VIDEO_SELECTOR)?.getAttribute('src');
            if (videoUrl?.startsWith('https://ssuin-object.commonscdn.com')) {
                sendResponse({ videoUrl });
            } else {
                // 동영상이 아직 로드되지 않은 경우 재생 버튼 클릭하여 로드 시도
                if (videoUrl !== '/settings/viewer/uniplayer/intro.mp4') {
                    document.querySelector('#front-screen > div > div.vc-front-screen-btn-container > div.vc-front-screen-btn-wrapper.video1-btn > div')?.click();
                }
                sendResponse({ videoUrl: null });
            }
            break;
        }
        case "get-video-playback-rate": {
            const video = document.querySelector(VIDEO_SELECTOR);
            if (video) {
                sendResponse({ playbackRate: video.playbackRate });
            } else {
                sendResponse({ playbackRate: 1.0 });
            }
            break;
        }
        case "set-video-playback-rate": {
            const video = document.querySelector(VIDEO_SELECTOR);
            if (video) {
                video.removeEventListener('ratechange', guard, true);
                video.addEventListener('ratechange', guard, true);
                video.playbackRate = message.data.playbackRate;
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, errorMessage: 'video element not found' });
            }
            break;
        }
        default:
            console.warn('video-iframe received message with unknown type:', message);
            break;
    }
    // TODO: error handling
});