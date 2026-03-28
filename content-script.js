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

    // await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/attendance_items/794113`)
    const courseId = root.getAttribute('data-course_id');
    const itemId = root.getAttribute('data-item_id');
    const userId = root.getAttribute('data-user_login');
    console.log({courseId, itemId, userId});
    
    //     const skipBtn = document.createElement('button');
    //     skipBtn.innerText = '학습 완료';
    //     root.appendChild(skipBtn);
})();

// GET https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794113/progress?user_id=20222904&content_id=69bd616f92eb6&content_type=movie&callback=jQuery111103847674061602282_1774676327407&state=8&duration=2428.16&currentTime=292.704&cumulativeTime=292.704&page=0&totalpage=0&cumulativePage=&_=1774676327410

// fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&content_type=everlec&callback=jQuery111105042207917339521_1774156359305&state=3&duration=2675.6&currentTime=1688.63&cumulativeTime=2600.48&page=0&totalpage=0&cumulativePage=&_=1774156359306`)
// fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&callback=aaa&state=3&duration=1&currentTime=0&cumulativeTime=2612.48`)
// https://commons.ssu.ac.kr/em/65f7de616e625?startat=1688.63&endat=2600.48&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F785670%2Fprogress%3Fuser_id%3D20222904%26content_id%3D65f7de616e625%26content_type%3Deverlec&sl=1&pr=1&mxpr=2.00&lg=ko
// https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&content_type=everlec


// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file