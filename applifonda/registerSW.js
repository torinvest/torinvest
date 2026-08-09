if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/applifonda/sw.js', { scope: '/applifonda/' })})}
