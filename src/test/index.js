import thumbnailScroll from '../index'

const thumbnail = new thumbnailScroll({
  target: document.querySelector('.target'),
  mode: 'skeleton',
  className: 'scroll',
  skeletonClassName: 'skeleton-item'
})

window.addEventListener('resize', () => thumbnail.refreshRect())
