'use strict';

const DEBUG = true;

(async () => {
    const iframe = document.querySelector('#tool_content');
    if (DEBUG) console.log('iframe', iframe);
    if (!iframe) return;

    // await the iframe loaded
    await new Promise((resolve) => { iframe.onload = resolve });

    const root = iframe.contentWindow.document.querySelector('#root');
    if (DEBUG) console.log('root', root);
    if (!root) return;

    const videoIframe = await new Promise((resolve) => {
        const observer = new MutationObserver((mutations, obs) => {
            const videoIframe = root.querySelector('div > div.xnlail-video-component > div.xnlailvc-commons-container > iframe');
            if (videoIframe) {
                resolve(videoIframe);
                obs.disconnect();
            }
        });
        observer.observe(root, {childList: true, subtree: true});
    });
    if (DEBUG) console.log('videoIframe', videoIframe);

    const videoSrc = videoIframe.getAttribute('src');
    if (DEBUG) console.log('videoSrc', videoSrc); // ex) ex) https://commons.ssu.ac.kr/em/69bd616f92eb6?startat=0.00&endat=0.00&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F794113%2Fprogress%3Fuser_id%3D20222904%26content_id%3D69bd616f92eb6%26content_type%3Dmovie&sl=1&pr=1&mxpr=1.00&lg=ko
    const targetUrl = new URL(videoSrc).searchParams.get('TargetUrl');
    if (DEBUG) console.log('targetUrl', targetUrl); // ex) https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794113/progress?user_id=20222904&content_id=69bd616f92eb6&content_type=movie

    const courseId = root.getAttribute('data-course_id');
    const itemId = root.getAttribute('data-item_id');
    if (DEBUG) console.log({courseId, itemId});
    
    // 학습 진행상황 정보 가져오기
    const check = async () => {
        const token = document.cookie.split(';').find((s) => s.startsWith(' xn_api_token'))?.replace(' xn_api_token=', '');
        const res = await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/${courseId}/attendance_items/${itemId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) return {};
        return await res.json();
    };
    const completeBtn = document.createElement('button');
    completeBtn.innerText = '학습 완료시키기';
    completeBtn.onclick = async () => {
        const c = await check();
        if (DEBUG) console.log(c);
        const duration = c.item_content_data?.duration ?? 1;
        if (c.attendance_data?.completed) {
            alert('이미 학습이 완료되었습니다.');
            return;
        }

        let delta = 10;
        for (let time = 0; ; time += delta) {
            const res = await fetch(`${targetUrl}&callback=aaa&state=8&duration=${duration}&currentTime=${time}&cumulativeTime=${time}`); // todo: duration 정하기
            console.log({time, delta});
            if (!res.ok) {
                console.log('response failed', {time, delta});
                break;
            }
            const text = await res.text();
            const json = JSON.parse(text.replace('aaa(', '').replace(')', ''));
            if (json.error_code) {
                console.warn('error:', json.error_code, {time, delta});
                delta = 10;
                time /= 2;
            } else {
                delta += 10;
            }

            const c = await check();
            if (c.attendance_data?.completed) {
                alert('학습이 완료되었습니다.');
                break;
            }
        }
    };
    root.appendChild(completeBtn);
})();

// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file