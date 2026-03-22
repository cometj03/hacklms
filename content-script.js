'use strict';

(() => {
    const iframe = document.querySelector('#tool_content');
    if (!iframe) return;

    iframe.onload = () => {
        const root = iframe.contentWindow.document.querySelector('#root');
        if (!root) return;

        console.log('iframe', iframe);
        console.log('root', root);

        const videoIframe = root.querySelectorAll('.xnlail-component-title');
        console.log(videoIframe);

        // videoSrc ex) https://commons.ssu.ac.kr/em/65f7de616e625?startat=1688.63&endat=2600.48&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F785670%2Fprogress%3Fuser_id%3D20222904%26content_id%3D65f7de616e625%26content_type%3Deverlec&sl=1&pr=1&mxpr=2.00&lg=ko
        const videoSrc = videoIframe.getAttribute('src');
        const targetUrl = new URL(videoSrc).searchParams.get('TargetUrl');
        console.log(targetUrl);

       // const courseId = root.getAttribute('data-course_id');
       // const itemId = root.getAttribute('data-item_id');
       // const userId = root.getAttribute('data-user_login');
    
        const skipBtn = document.createElement('button');
        skipBtn.innerText = '학습 완료';
    
        root.appendChild(skipBtn);
    };
})();

// fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&content_type=everlec&callback=jQuery111105042207917339521_1774156359305&state=3&duration=2675.6&currentTime=1688.63&cumulativeTime=2600.48&page=0&totalpage=0&cumulativePage=&_=1774156359306`)
// fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&callback=aaa&state=3&duration=1&currentTime=0&cumulativeTime=2612.48`)
// https://commons.ssu.ac.kr/em/65f7de616e625?startat=1688.63&endat=2600.48&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F785670%2Fprogress%3Fuser_id%3D20222904%26content_id%3D65f7de616e625%26content_type%3Deverlec&sl=1&pr=1&mxpr=2.00&lg=ko
// https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/785670/progress?user_id=20222904&content_id=65f7de616e625&content_type=everlec