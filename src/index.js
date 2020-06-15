import './index.scss'

const getValueOfPx = value => +value.replace(/px$/, '')

export default class thumbnailScroll {
  constructor(option) {
    this.mergeOption(option)
    this.init()
  }

  mergeOption(optionData) {
    const option = Object.assign({
      parentElement: document.body,
      mode: 'skeleton',
      scale: 0.1,
      boundaryScrollSpeed: 8
    }, optionData)

    const { scrollLayer, scrollXLayer, scrollYLayer, scale } = option

    // 确定滚动层
    if (scrollLayer) option.scrollXLayer = option.scrollYLayer = scrollLayer
    if (!scrollXLayer || scrollXLayer === window) option.scrollXLayer = document.documentElement
    if (!scrollYLayer || scrollYLayer === window) option.scrollYLayer = document.documentElement

    // 自动设置宽高
    const scrollWidth = option.scrollXLayer.scrollWidth
    const scrollHeight = option.scrollYLayer.scrollHeight
    // 高度或宽度铺满
    option.height = option.width = (scrollWidth > scrollHeight ? scrollHeight : scrollWidth) * scale

    this.option = option
  }

  init() {
    this.createElement()
    this.setEvent()
    this.syncContent(0, 'init')
  }

  createElement() {
    const { mode, skeleton, width, height, parentElement, className } = this.option
    const root = document.createElement('div')
    root.classList.add('thumbnail-scroll', className || '')
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
      if (!skeleton instanceof Object) return console.log('"option.skeleton" should be a Object')
      this.createSkeleton()
    }

    this.createRect()
  }

  createSkeleton() {
    const { scale, scrollXLayer, scrollYLayer } = this.option
    const scrollWidth = scrollXLayer.scrollWidth
    const scrollHeight = scrollYLayer.scrollHeight
    const content = document.createElement('div')
    const { style } = content
    style.width = `${scrollWidth * scale}px`
    style.height = `${scrollHeight * scale}px`
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
    const rectWidth = Math.min(scrollXLayer.clientWidth, scrollYLayer.clientWidth)
    const rectHeight = Math.min(scrollXLayer.clientHeight, scrollYLayer.clientHeight)
    style.width = `${rectWidth * scale}px`
    style.height = `${rectHeight * scale}px`
    this.rect = rect
    this.root.appendChild(rect)
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
    const content = this.content
    const { width: contentWidth, height: contentHeight } = content.getBoundingClientRect()
    const { style: rectStyle } = this.rect

    const offsetX = (oldScrollValue - scrollXLayer.scrollLeft) * scale
    if (/x|init/.test(type) && offsetX) {
      if (this.contentAllowMove(offsetX)) {
        this.translateX = this.translateX + offsetX
      } else {
        const maxTranslateX = contentWidth - width
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
          this.content.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`
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
      if (button !== 0) return
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
    window.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      this.boundaryScrollData.x = ''
      this.boundaryScrollData.y = ''
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

  createSkeletonItem() {
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
        skeletonItemStyle.left = `${(itemLeft - scrollXLayerLeft) * scale}px`
        skeletonItemStyle.top = `${(itemTop - scrollYLayerTop) * scale}px`
        skeletonItemStyle.backgroundColor = skeleton[className]
        this.content.appendChild(skeletonItem)
      })
    }
  }

  rectMove(x = 0, y = 0) {
    const rect = this.rect
    const { style: rectStyle } = this.rect
    const { width: rectWidth, height: rectHeight } = rect.getBoundingClientRect()
    const { width: rootWidth, height: rootHeight } = this.rootPositionData
    if (x) {
      if (this.rectAllowMove(x)) {
        rectStyle.left = `${getValueOfPx(rectStyle.left) + x}px`
      } else {
        rectStyle.left = `${x > 0 ? rootWidth - rectWidth : 0}px`
      }
    }
    if (y) {
      if (this.rectAllowMove(y, true)) {
        rectStyle.top = `${getValueOfPx(rectStyle.top) + y}px`
      } else {
        rectStyle.top = `${y > 0 ? rootHeight - rectHeight : 0}px`
      }
    }
  }
}
