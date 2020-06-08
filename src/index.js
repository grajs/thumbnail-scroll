import './index.scss'

const getValueOfPx = value => +value.replace(/px$/, '')

export default class thumbnailScroll {
  constructor(option) {
    if (!option.target || option.target.nodeType !== 1) return console.log('"option.target" should be a element')
    this.mergeOption(option)
    this.init()
  }

  mergeOption(optionData) {
    const option = Object.assign({
      parentElement: document.body,
      // skeleton || image
      mode: 'dom',
      width: 200,
      height: 200,
      skeletonClassName: ''
    }, optionData)

    let {
      target,
      scrollLayer,
      scrollXLayer,
      scrollYLayer,
      scale,
      // 宽度或高度铺满
      fullOrientation,
      width,
      height
    } = option

    // 确定滚动层
    if (scrollLayer) option.scrollXLayer = option.scrollYLayer = scrollLayer
    if (!scrollXLayer || scrollXLayer === window) option.scrollXLayer = document.documentElement
    if (!scrollYLayer || scrollYLayer === window) option.scrollYLayer = document.documentElement

    // 自动设置比例
    if (!scale) {
      const { width: targetWidth, height: targetHeight } = target.getBoundingClientRect()
      if (!/^width|height$/.test(fullOrientation)) {
        fullOrientation = targetWidth > targetHeight ? 'height' : 'width'
      }
      option.scale = fullOrientation === 'width' ? width / targetWidth : height / targetHeight
    }
    this.option = option
    this.target = option.target
  }

  init() {
    this.createElement()
    this.setEvent()
    this.syncContent(0, 'init')
  }

  createElement() {
    const { mode, skeletonClassName, width, height, parentElement } = this.option
    const root = document.createElement('div')
    root.classList.add('thumbnail-scroll')
    root.style.width = `${width}px`
    root.style.height = `${height}px`
    parentElement && parentElement.appendChild(root)
    this.root = root

    const { left: rootLeft, top: rootTop } = root.getBoundingClientRect()
    this.rootPositionData = {
      width: root.clientWidth,
      height: root.clientHeight,
      left: rootLeft + root.clientLeft,
      top: rootTop + root.clientTop,
      right: rootLeft + root.clientLeft + root.clientWidth,
      bottom: rootTop + root.clientTop + root.clientHeight
    }

    if (mode === 'skeleton') {
      if (typeof skeletonClassName !== 'string') return console.log('"option.skeletonClassName" should be a String')
      this.createSkeleton()
    }

    this.createRect()
  }

  createSkeleton() {
    const { scale } = this.option
    const { width: targetWidth, height: targetHeight } = this.target.getBoundingClientRect()
    const content = document.createElement('div')
    const { style } = content
    style.width = `${targetWidth * scale}px`
    style.height = `${targetHeight * scale}px`
    content.classList.add('thumbnail-scroll-content', 'is-skeleton')
    this.root.appendChild(content)
    this.content = content
    this.createSkeletonItem()
  }

  createRect() {
    const { scrollXLayer, scrollYLayer, scale } = this.option
    const rect = document.createElement('div')
    rect.classList.add('thumbnail-scroll-rect')
    const { style } = rect
    style.width = `${scrollXLayer.clientWidth * scale}px`
    style.height = `${scrollYLayer.clientHeight * scale}px`
    style.left = `${scrollXLayer.scrollLeft * scale}px`
    style.top = `${scrollYLayer.scrollTop * scale}px`
    this.rect = rect
    this.root.appendChild(rect)
  }

  setEvent() {
    this.boundaryScrollInterval = null
    this.translateX = 0
    this.translateY = 0
    this.scrollXLock = false
    this.scrollYLock = false
    this.setRectDrag()
    this.setContainerDrag()
    this.setScrollEvent()
    this.setContentClick()
  }

  // 将矩形和内容偏移量映射到滚动条
  syncScroll(lockScroll) {
    const { scale, scrollXLayer, scrollYLayer } = this.option
    const { left: rectLeft, top: rectTop } = this.rect.style
    const nextScrollX = (getValueOfPx(rectLeft) - this.translateX) / scale
    const nextScrollY = (getValueOfPx(rectTop) - this.translateY) / scale
    if (nextScrollX !== scrollXLayer.scrollLeft) {
      scrollXLayer.scrollLeft = (getValueOfPx(rectLeft) - this.translateX) / scale
      if (lockScroll) this.scrollXLock = true
    }
    if (nextScrollY !== scrollYLayer.scrollTop) {
      scrollYLayer.scrollTop = (getValueOfPx(rectTop) - this.translateY) / scale
      if (lockScroll) this.scrollYLock = true
    }
  }

  // 将滚动条位置映射到内容区和矩形
  syncContent(oldScrollValue, type) {
    const { width, height, scale, scrollXLayer, scrollYLayer } = this.option
    const content = this.content
    const { width: contentWidth, height: contentHeight } = content.getBoundingClientRect()
    const { style: rectStyle } = this.rect

    if (/x|init/.test(type)) {
      const offsetX = (scrollXLayer.scrollLeft - oldScrollValue) * scale
      if (this.contentAllowMove(offsetX)) {
        this.translateX = this.translateX - offsetX
      } else {
        const maxTranslateX = contentWidth - width
        const surplusX = maxTranslateX + this.translateX
        this.translateX = maxTranslateX
        rectStyle.left = `${getValueOfPx(rectStyle.left) + offsetX - surplusX}px`
      }
    }
    if (/y|init/.test(type)) {
      const offsetY = (oldScrollValue - scrollYLayer.scrollTop) * scale
      if (this.contentAllowMove(offsetY, true)) {
        this.translateY = this.translateY + offsetY
      } else {
        const maxTranslateY = contentHeight - height
        // 向上滚动
        if (offsetY < 0) {
          this.translateY = -maxTranslateY
          rectStyle.top = `${scrollYLayer.scrollTop * scale - maxTranslateY}px`
        } else {
          this.translateY = 0
          rectStyle.top = `${scrollYLayer.scrollTop * scale}px`
        }
      }
    }

    content.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
  }

  // 内容偏移一定距离后是否会超出边界
  contentAllowMove(offset, isVertical) {
    const { width, height } = this.option
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    if (isVertical) {
      const nextTranslateY = this.translateY + offset
      return nextTranslateY <= 0 && nextTranslateY >= height - contentHeight
    } else {
      const nextTranslateX = this.translateX + offset
      return nextTranslateX <= 0 && nextTranslateX >= width - contentWidth
    }
  }

  // 拖动矩形
  setRectDrag() {
    const rect = this.rect
    let dragging = false
    let oldClientX = 0
    let oldClientY = 0
    rect.addEventListener('mousedown', ({ button, clientX, clientY }) => {
      if (button !== 0) return
      oldClientX = clientX
      oldClientY = clientY
      dragging = true
    })
    this.root.addEventListener('mousemove', ({ clientX, clientY }) => {
      if (!dragging) return
      this.rectMove(clientX - oldClientX, clientY - oldClientY)
      oldClientX = clientX
      oldClientY = clientY
    })
    window.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      this.syncScroll(true)
    })
  }

  // 点击非矩形区定位
  setContentClick() {
    // 点击事件不允许有偏移行为，否则视为拖拽内容区
    const root = this.root
    const oldClient = { x: 0, y: 0 }
    root.addEventListener('mousedown', e => {
      if (e.target === this.rect) return
      oldClient.x = e.clientX
      oldClient.y = e.clientY
    })
    root.addEventListener('mouseup', e => {
      if (e.target === this.rect) return
      if (e.clientX !== oldClient.x || e.clientY !== oldClient.y) return
      const { left: rectLeft, top: rectTop, width: rectWidth, height: rectHeight } = this.rect.getBoundingClientRect()
      const offsetX = e.clientX - rectLeft - rectWidth / 2
      const offsetY = e.clientY - rectTop - rectHeight / 2
      this.rectMove(offsetX, offsetY)
      this.syncScroll(true)
    })
  }

  // 拖拽非矩形区内容滚动
  setContainerDrag() {
    let rootDragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.root.addEventListener('mousedown', e => {
      if (e.target !== this.root || e.button) return
      oldClientX = e.clientX
      oldClientY = e.clientY
      rootDragging = true
    })
    this.root.addEventListener('mousemove', ({ button, clientX, clientY }) => {
      if (!rootDragging || button) return
      const offsetX = clientX - oldClientX
      const offsetY = clientY - oldClientY
      if (this.contentAllowMove(offsetX)) this.translateX = this.translateX + offsetX
      if (this.contentAllowMove(offsetY, true)) this.translateY = this.translateY + offsetY
      this.content.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
      oldClientX = clientX
      oldClientY = clientY
    })
    window.addEventListener('mouseup', ({ button }) => {
      if (!rootDragging || button) return
      rootDragging = false
      this.syncScroll(true)
    })
  }

  setScrollEvent() {
    const { width, height, scale, scrollXLayer, scrollYLayer } = this.option
    const content = this.content
    const { style: rectStyle } = this.rect
    const { width: contentWidth, height: contentHeight } = content.getBoundingClientRect()
    const scrollXElement = scrollXLayer === document.documentElement ? window : scrollXLayer
    const scrollYElement = scrollYLayer === document.documentElement ? window : scrollYLayer
    let oldScrollLeft = scrollXLayer.scrollLeft
    let oldScrollTop = scrollYLayer.scrollTop
    scrollXElement.addEventListener('scroll', () => {
      if (this.scrollXLock) {
        oldScrollLeft = scrollXLayer.scrollLeft
        this.scrollXLock = false
        return
      }
      this.syncContent(oldScrollLeft, 'x')
      oldScrollLeft = scrollXLayer.scrollLeft
    })
    scrollYElement.addEventListener('scroll', () => {
      if (this.scrollYLock) {
        oldScrollTop = scrollYLayer.scrollTop
        this.scrollYLock = false
        return
      }
      this.syncContent(oldScrollTop, 'y')
      oldScrollTop = scrollYLayer.scrollTop
    })
  }

  createSkeletonItem() {
    const { target, skeletonClassName, scale } = this.option
    const { left: targetLeft, top: targetTop } = target.getBoundingClientRect()
    target.querySelectorAll(`.${skeletonClassName}`).forEach(item => {
      const { width: itemWidth, height: itemHeight, x: itemLeft, y: itemTop } = item.getBoundingClientRect()
      const skeletonItem = document.createElement('div')
      skeletonItem.classList.add('thumbnail-skeleton-item')
      const skeletonItemStyle = skeletonItem.style
      skeletonItemStyle.width = `${itemWidth * scale}px`
      skeletonItemStyle.height = `${itemHeight * scale}px`
      skeletonItemStyle.left = `${(itemLeft - targetLeft) * scale}px`
      skeletonItemStyle.top = `${(itemTop - targetTop) * scale}px`
      this.content.appendChild(skeletonItem)
    })
  }

  rectMove(x = 0, y = 0) {
    const rect = this.rect
    const { style: rectStyle } = rect
    const { left: rectLeft, right: rectRight, top: rectTop, bottom: rectBottom } = rect.getBoundingClientRect()
    const { left: rootLeft, right: rootRight, top: rootTop, bottom: rootBottom } = this.rootPositionData
    if (x) {
      let offsetX = x
      if (x > 0) {
        const surplusRight = rootRight - rectRight
        // 右侧距离不够的情况尝试移动内容区
        if (surplusRight < x) offsetX = surplusRight
      }
      if (x < 0) {
        const surplusLeft = rectLeft - rootLeft
        // 左侧距离不够的情况尝试移动内容区
        if (surplusLeft < Math.abs(x)) offsetX = -surplusLeft
      }
      if (x) rectStyle.left = `${getValueOfPx(rectStyle.left) + offsetX}px`
    }
    if (y) {
      let offsetY = y
      if (y > 0) {
        const surplusBottom = rootBottom - rectBottom
        // 下方距离不够的情况尝试移动内容区
        if (surplusBottom < y) offsetY = surplusBottom
      }
      if (y < 0) {
        const surplusTop = rectTop - rootTop
        // 上方距离不够的情况尝试移动内容区
        if (surplusTop < Math.abs(y)) offsetY = -surplusTop
      }
      if (y) rectStyle.top = `${getValueOfPx(rectStyle.top) + offsetY}px`
    }
  }
}
