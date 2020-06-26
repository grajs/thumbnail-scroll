import './index.scss'

const getValueOfPx = value => +value.replace(/px$/, '')
const isHtmlElement = target => /HTML/.test(Object.prototype.toString.call(target))

export default class thumbnailScroll {
  constructor(option) {
    if (!this.optionValidate(option)) return
    this.mergeOption(option)
    this.init()
  }

  optionValidate(option) {
    const { scrollLayer, parentElement, mode, skeleton, size, scale } = option
    if (scrollLayer) {
      const warnInfo = '"option.scrollLayer" should be a HtmlElement or { x: HtmlElement, y: HtmlElement}'
      if (typeof scrollLayer !== 'object') return console.warn(warnInfo)
      if (!isHtmlElement(scrollLayer)) {
        if (!isHtmlElement(scrollLayer.x) || !isHtmlElement(scrollLayer.y)) return console.warn(warnInfo)
      }
    }
    if (parentElement && !isHtmlElement(parentElement)) return console.warn('"option.parentElement" should be a HtmlElement')
    if (size) {
      if (size <= 0) return console.warn('"option.size" must be greater than 0')
    } else {
      if (!scale) return console.warn('"option.size" or "option.scale" is required and must be greater than 0')
      if (scale <= 0) return console.warn('"option.scale" must be greater than 0')
    }
    if (mode === 'skeleton' && !(skeleton instanceof Object)) return console.warn('"option.skeleton" should be a Object')
    return true
  }

  mergeOption(optionData) {
    const option = Object.assign({
      parentElement: document.body,
      scrollLayer: document.documentElement,
      mode: 'skeleton',
      boundaryScrollSpeed: 8
    }, optionData)

    // 确定滚动层
    const { scrollLayer } = option
    if (isHtmlElement(scrollLayer)) {
      option.scrollXLayer = option.scrollYLayer = scrollLayer
    } else {
      option.scrollXLayer = scrollLayer.x
      option.scrollYLayer = scrollLayer.y
    }

    this.option = option
    this.computedOption()
  }

  computedOption() {
    const { scale, size, scrollXLayer, scrollYLayer } = this.option
    // 自动设置宽高
    const scrollWidth = scrollXLayer.scrollWidth
    const scrollHeight = scrollYLayer.scrollHeight
    // 高度或宽度铺满
    if (size) {
      this.option.height = this.option.width = size
      this.option.scale = size / (scrollWidth > scrollHeight ? scrollHeight : scrollWidth)
    } else {
      this.option.height = this.option.width = (scrollWidth > scrollHeight ? scrollHeight : scrollWidth) * scale
    }
  }

  init() {
    this.createElement()
    this.windowEventList = []
    this.setEvent()
    this.syncContent(0, 'init')
  }

  createElement() {
    const { mode } = this.option
    this.createRoot()
    this.createContainer()
    mode === 'skeleton' && this.createSkeleton()
    this.createRect()
  }

  createRoot() {
    const { parentElement, className } = this.option
    const root = document.createElement('div')
    root.classList.add('thumbnail-scroll', className || '')
    parentElement && parentElement.appendChild(root)
    this.root = root
    this.setRootStyle()
  }

  // 性能考虑，提前计算好，后面移动会多次获取
  setRootStyle() {
    const { width, height } = this.option
    const root = this.root
    root.style.width = `${width}px`
    root.style.height = `${height}px`
    const { left: rootLeft, top: rootTop } = root.getBoundingClientRect()
    this.rootPositionData = {
      width: root.clientWidth,
      height: root.clientHeight,
      left: rootLeft + root.clientLeft,
      top: rootTop + root.clientTop,
      right: rootLeft + root.clientLeft + root.clientWidth,
      bottom: rootTop + root.clientTop + root.clientHeight
    }
  }

  createContainer() {
    const container = document.createElement('div')
    container.classList.add('thumbnail-scroll-container', 'is-skeleton')
    this.root.appendChild(container)
    this.container = container
    this.setContainerStyle()
  }

  setContainerStyle() {
    const { scale, scrollXLayer, scrollYLayer } = this.option
    const scrollWidth = scrollXLayer.scrollWidth
    const scrollHeight = scrollYLayer.scrollHeight
    const { style } = this.container
    style.width = `${scrollWidth * scale}px`
    style.height = `${scrollHeight * scale}px`
  }

  createSkeleton() {
    this.container.innerHTML = ''
    const { scrollXLayer, scrollYLayer, skeleton, scale } = this.option
    const commonParent = scrollXLayer.contains(scrollYLayer) ? scrollXLayer : scrollYLayer
    const { left: scrollXLayerLeft } = scrollXLayer.getBoundingClientRect()
    const { top: scrollYLayerTop } = scrollYLayer.getBoundingClientRect()
    for (const className in skeleton) {
      commonParent.querySelectorAll(`.${className}`).forEach(item => {
        const { width: itemWidth, height: itemHeight, x: itemLeft, y: itemTop } = item.getBoundingClientRect()
        const skeletonItem = document.createElement('div')
        skeletonItem.classList.add('thumbnail-skeleton-item')
        const skeletonItemStyle = skeletonItem.style
        skeletonItemStyle.width = `${itemWidth * scale}px`
        skeletonItemStyle.height = `${itemHeight * scale}px`
        skeletonItemStyle.left = `${(itemLeft - scrollXLayerLeft + scrollXLayer.scrollLeft) * scale}px`
        skeletonItemStyle.top = `${(itemTop - scrollYLayerTop + scrollYLayer.scrollTop) * scale}px`
        skeletonItemStyle.backgroundColor = skeleton[className]
        this.container.appendChild(skeletonItem)
      })
    }
  }

  createRect() {
    const rect = document.createElement('div')
    rect.classList.add('thumbnail-scroll-rect')
    this.root.appendChild(rect)
    this.rect = rect
    this.setRectStyle()
  }

  setRectStyle() {
    const { scrollXLayer, scrollYLayer, scale } = this.option
    const { style } = this.rect
    const rectWidth = Math.min(scrollXLayer.clientWidth, scrollYLayer.clientWidth)
    const rectHeight = Math.min(scrollXLayer.clientHeight, scrollYLayer.clientHeight)
    style.width = `${rectWidth * scale}px`
    style.height = `${rectHeight * scale}px`
  }

  setEvent() {
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
    const container = this.container
    const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect()
    const { style: rectStyle } = this.rect

    const offsetX = (oldScrollValue - scrollXLayer.scrollLeft) * scale
    if (/x|init/.test(type) && offsetX) {
      if (this.contentAllowMove(offsetX)) {
        this.translateX = this.translateX + offsetX
      } else {
        const maxTranslateX = containerWidth - width
        // 向右滚动
        if (offsetX < 0) {
          this.translateX = -maxTranslateX
          rectStyle.left = `${scrollXLayer.scrollLeft * scale - maxTranslateX}px`
        } else {
          this.translateX = 0
          rectStyle.left = `${scrollXLayer.scrollLeft * scale}px`
        }
      }
    }
    const offsetY = (oldScrollValue - scrollYLayer.scrollTop) * scale
    if (/y|init/.test(type) && offsetY) {
      if (this.contentAllowMove(offsetY, true)) {
        this.translateY = this.translateY + offsetY
      } else {
        const maxTranslateY = containerHeight - height
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

    container.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
  }

  // 内容偏移一定距离后是否会超出边界
  contentAllowMove(offset, isVertical) {
    const { width, height } = this.option
    const { width: containerWidth, height: containerHeight } = this.container.getBoundingClientRect()
    if (isVertical) {
      const nextTranslateY = this.translateY + offset
      return nextTranslateY <= 0 && nextTranslateY >= height - containerHeight
    } else {
      const nextTranslateX = this.translateX + offset
      return nextTranslateX <= 0 && nextTranslateX >= width - containerWidth
    }
  }

  rectAllowMove(offset, isVertical) {
    const { left: rectLeft, right: rectRight, top: rectTop, bottom: rectBottom } = this.rect.getBoundingClientRect()
    const { left: rootLeft, right: rootRight, top: rootTop, bottom: rootBottom } = this.rootPositionData
    // 向下/右移动
    if (offset > 0) {
      const surplusValue = isVertical ? rootBottom - rectBottom : rootRight - rectRight
      return surplusValue >= offset
    }
    // 向上/左移动
    if (offset < 0) {
      const surplusValue = isVertical ? rootTop - rectTop : rootLeft - rectLeft
      return surplusValue <= offset
    }
  }

  boundaryScroll() {
    const { boundaryScrollSpeed } = this.option
    if (this.boundaryScrollData.x || this.boundaryScrollData.y) {
      if (!this.boundaryScrollInterval) {
        this.boundaryScrollInterval = setInterval(() => {
          const { x: dataX, y: dataY } = this.boundaryScrollData
          if (dataX === 'left') {
            if (this.contentAllowMove(1)) {
              this.translateX++
            } else {
              this.boundaryScrollData.x = ''
            }
          }
          if (dataX === 'right') {
            if (this.contentAllowMove(-1)) {
              this.translateX--
            } else {
              this.boundaryScrollData.x = ''
            }
          }
          if (dataY === 'down') {
            if (this.contentAllowMove(-1, true)) {
              this.translateY--
            } else {
              this.boundaryScrollData.y = ''
            }
          }
          if (dataY === 'up') {
            if (this.contentAllowMove(1, true)) {
              this.translateY++
            } else {
              this.boundaryScrollData.y = ''
            }
          }
          this.container.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
        }, boundaryScrollSpeed)
      }
    } else {
      if (this.boundaryScrollInterval) {
        clearInterval(this.boundaryScrollInterval)
        this.boundaryScrollInterval = 0
      }
    }
  }

  // 拖动矩形
  setRectDrag() {
    const rect = this.rect
    let dragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.boundaryScrollData = { x: '', y: '' }
    rect.addEventListener('mousedown', ({ button, clientX, clientY }) => {
      if (button) return
      oldClientX = clientX
      oldClientY = clientY
      dragging = true
    })
    this.root.addEventListener('mousemove', ({ clientX, clientY }) => {
      if (!dragging) return
      const offsetX = clientX - oldClientX
      const offsetY = clientY - oldClientY
      this.rectMove(offsetX, offsetY)
      const { x: dataX, y: dataY } = this.boundaryScrollData
      if (offsetX > 0) {
        if (!this.rectAllowMove(offsetX)) {
          this.boundaryScrollData.x = 'right'
        } else if (dataX === 'left') {
          this.boundaryScrollData.x = ''
        }
      }
      if (offsetX < 0) {
        if (!this.rectAllowMove(offsetX)) {
          this.boundaryScrollData.x = 'left'
        } else if (dataX === 'right') {
          this.boundaryScrollData.x = ''
        }
      }
      if (offsetY > 0) {
        if (!this.rectAllowMove(offsetY, true)) {
          this.boundaryScrollData.y = 'down'
        } else if (dataY === 'up') {
          this.boundaryScrollData.y = ''
        }
      }
      if (offsetY < 0) {
        if (!this.rectAllowMove(offsetY, true)) {
          this.boundaryScrollData.y = 'up'
        } else if (dataY === 'down') {
          this.boundaryScrollData.y = ''
        }
      }
      this.boundaryScroll()
      oldClientX = clientX
      oldClientY = clientY
    })
    const mouseupEvent = () => {
      if (!dragging) return
      dragging = false
      this.boundaryScrollData.x = ''
      this.boundaryScrollData.y = ''
      this.syncScroll(true)
    }
    this.windowEventList.push({ key: 'mouseup', event: mouseupEvent })
    window.addEventListener('mouseup', mouseupEvent)
  }

  // 点击非矩形区定位
  setContentClick() {
    // 点击事件不允许有偏移行为，否则视为拖拽内容区
    const root = this.root
    const oldClient = { x: 0, y: 0 }
    root.addEventListener('mousedown', e => {
      if (e.target === this.rect || e.button) return
      oldClient.x = e.clientX
      oldClient.y = e.clientY
    })
    root.addEventListener('mouseup', e => {
      if (e.target === this.rect || e.button) return
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
      this.container.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
      oldClientX = clientX
      oldClientY = clientY
    })
    const mouseupEvent = ({ button }) => {
      if (!rootDragging || button) return
      rootDragging = false
      this.syncScroll(true)
    }
    this.windowEventList.push({ key: 'mouseup', event: mouseupEvent })
    window.addEventListener('mouseup', mouseupEvent)
  }

  setScrollEvent() {
    const { scrollXLayer, scrollYLayer } = this.option
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

  rectMove(offsetX, offsetY) {
    const rect = this.rect
    const { style: rectStyle } = this.rect
    const { width: rectWidth, height: rectHeight } = rect.getBoundingClientRect()
    const { width: rootWidth, height: rootHeight } = this.rootPositionData
    if (offsetX) {
      if (this.rectAllowMove(offsetX)) {
        rectStyle.left = `${getValueOfPx(rectStyle.left) + offsetX}px`
      } else {
        rectStyle.left = `${offsetX > 0 ? rootWidth - rectWidth : 0}px`
      }
    }
    if (offsetY) {
      if (this.rectAllowMove(offsetY, true)) {
        rectStyle.top = `${getValueOfPx(rectStyle.top) + offsetY}px`
      } else {
        rectStyle.top = `${offsetY > 0 ? rootHeight - rectHeight : 0}px`
      }
    }
  }

  reRender() {
    this.computedOption()
    this.setRootStyle()
    this.setContainerStyle()
    this.createSkeleton()
    this.setRectStyle()
    this.syncContent(0, 'init')
  }

  destroy() {
    if (this.root) {
      this.root.parentElement && this.root.parentElement.removeChild(this.root)
      this.root = null
    }
    this.windowEventList.forEach(({ key, event }) => {
      window.removeEventListener(key, event)
    })
    this.windowEventList = []
  }
}
