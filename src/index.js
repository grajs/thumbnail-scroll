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
    this.createRect()
    this.setEvent()
    this.syncRect(0, 'init')
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
  }

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

  // 拖动矩形
  setRectDrag() {
    const rect = this.rect
    let dragging = false
    let oldClientX = 0
    let oldClientY = 0
    this.rectMoveData = {
      left: false,
      right: false,
      top: false,
      bottom: false
    }
    rect.addEventListener('mousedown', ({ button, clientX, clientY }) => {
      if (button !== 0) return
      oldClientX = clientX
      oldClientY = clientY
      dragging = true
    })
    this.root.addEventListener('mousemove', ({ clientX, clientY }) => {
      if (!dragging) return
      this.move(clientX - oldClientX, clientY - oldClientY)
      oldClientX = clientX
      oldClientY = clientY
    })
    window.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      this.syncScroll(true)
    })
  }

  // 偏移一定距离后是否会超出边界
  allowMove(offset, isVertical) {
    const { width, height } = this.option
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    if (isVertical) {
      const nextTranslateY = this.translateY + offset
      return nextTranslateY <= 0 && nextTranslateY >= -(contentHeight - height)
    } else {
      const nextTranslateX = this.translateX + offset
      return nextTranslateX <= 0 && nextTranslateX >= -(contentWidth - width)
    }
  }

  // 拖拽非活动块
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
      if (this.allowMove(offsetX)) this.translateX = this.translateX + offsetX
      if (this.allowMove(offsetY, true)) this.translateY = this.translateY + offsetY
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
      this.syncRect(oldScrollLeft, 'x')
      oldScrollLeft = scrollXLayer.scrollLeft
    })
    scrollYElement.addEventListener('scroll', () => {
      if (this.scrollYLock) {
        oldScrollTop = scrollYLayer.scrollTop
        this.scrollYLock = false
        return
      }
      this.syncRect(oldScrollTop, 'y')
      oldScrollTop = scrollYLayer.scrollTop
    })
  }

  syncRect(oldScrollValue, type) {
    const { width, height, scale, scrollXLayer, scrollYLayer } = this.option
    const content = this.content
    const { width: contentWidth, height: contentHeight } = content.getBoundingClientRect()
    const { style: rectStyle } = this.rect

    if (/x|init/.test(type)) {
      const offsetX = (scrollXLayer.scrollLeft - oldScrollValue) * scale
      if (this.allowMove(offsetX)) {
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
      if (this.allowMove(offsetY, true)) {
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

  stopBoundaryScroll() {
    if (!this.boundaryScrollInterval) return
    clearInterval(this.boundaryScrollInterval)
    this.boundaryScrollInterval = null
  }

  setBoundaryData() {
    const { size } = this.option
    const rect = this.rect
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    const { width: rectWidth, height: rectHeight } = rect.getBoundingClientRect()
    const rectStyle = getComputedStyle(rect)
    const rectLeft = getValueOfPx(rectStyle.left)
    const rectTop = getValueOfPx(rectStyle.top)
    this.boundaryData = {
      left: rectLeft === 0 && this.translateX < 0 && this.rectMoveData.left,
      right: Math.abs(rectLeft - (size - rectWidth)) < 1 && this.translateX * scale > size - contentWidth && this.rectMoveData.right,
      top: rectTop === 0 && this.translateY < 0 && this.rectMoveData.top,
      bottom: Math.abs(rectTop - (size - rectHeight)) < 1 && this.translateY * scale > size - contentHeight && this.rectMoveData.bottom
    }
  }

  boundaryScroll() {
    const { size } = this.option
    const { width: contentWidth, height: contentHeight } = this.content.getBoundingClientRect()
    const content = this.content
    const touchBoundary = () => this.boundaryData.left || this.boundaryData.right || this.boundaryData.top || this.boundaryData.bottom
    if (touchBoundary) {
      if (this.boundaryScrollInterval) return
      this.boundaryScrollInterval = setInterval(() => {
        if (this.boundaryData.left) {
          this.translateX = this.translateX + 3 / scale
          if (this.translateX > 0) {
            this.translateX = 0
            this.boundaryData.left = false
          }
        }
        if (this.boundaryData.top) {
          this.translateY = this.translateY + 3 / scale
          if (this.translateY > 0) {
            this.translateY = 0
            this.boundaryData.top = false
          }
        }
        if (this.boundaryData.right) {
          this.translateX = this.translateX - 3 / scale
          const maxLeft = -(contentWidth - size) / scale
          if (this.translateX < maxLeft) {
            this.translateX = Math.round(maxLeft)
            this.boundaryData.right = false
          }
        }
        if (this.boundaryData.bottom) {
          this.translateY = this.translateY - 3 / scale
          const maxTop = -(contentHeight - size) / scale
          if (this.translateY < maxTop) {
            this.translateY = Math.round(maxTop)
            this.boundaryData.bottom = false
          }
        }
        !touchBoundary() && this.stopBoundaryScroll()
        contentElement.style.transform = `scale(${scale}) translate(${this.translateX}px, ${this.translateY}px)`
      }, 20)
    } else {
      this.stopBoundaryScroll()
    }
  }

  move(x = 0, y = 0) {
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
        if (surplusLeft < Math.abs(x)) offsetX = surplusLeft
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
        if (surplusTop < Math.abs(y)) offsetY = surplusTop
      }
      if (y) rectStyle.top = `${getValueOfPx(rectStyle.top) + offsetY}px`
    }
  }
}
