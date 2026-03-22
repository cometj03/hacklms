'use strict';

console.log('hi');

(() => {
    const root = document.querySelector('#root');
    if (!root) return;
    console.log(root)

    const skipBtn = document.createElement('button');
    skipBtn.innerText = 'skip';

    root.appendChild(skipBtn);
})();