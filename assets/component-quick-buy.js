if (customElements.get('quick-buy') === undefined) {

  customElements.define('quick-buy', class QuickBuy extends HTMLElement {
    constructor() {
      'use strict';
      super();

      this.processingModal = false;
      this.button = this.querySelector('a[href*="modal"]');

      if (!this.button) {
        console.error('Quick buy button not found');
        return;
      }

      this.targetModalId = this.button.getAttribute('href').substring(1);
      this.quickBuyProductHandle = this.button.dataset.productHandle;
      this.rootUrl = window.routes.root == '/' ? '/' : window.routes.root + '/'; // if user has selected locale convert root url from /en-gb to /en-gb/

      // Extract product ID from modal ID (format: modal-{productId}-product)
      const modalIdMatch = this.targetModalId.match(/modal-(\d+)-product/);
      const productId = modalIdMatch ? modalIdMatch[1] : this.quickBuyProductHandle;

      // Set missing dataset properties
      this.dataset.product = productId;
      this.dataset.url = this.button.dataset.url || window.location.origin + '/products/' + this.quickBuyProductHandle;

      this.button.addEventListener('click', this.onModalRequestOpen.bind(this))
    }

    async onModalRequestOpen(event) {
      event.preventDefault();
      if (this.processingModal === true) {
        return;
      }

      const modal = document.getElementById(this.targetModalId);

      if (modal) {
        Woolman.ModalsAndDrawers.showModalOrDrawer(this.targetModalId);
        return;
      };

      this.processingModal = true;

      // Clean up any existing quick buy modals
      document.querySelectorAll('[data-quick-buy-modal]').forEach((modal) => {
        modal.remove();
      })

      try {
        const res = await fetch(`${this.rootUrl}products/${this.quickBuyProductHandle}?view=ajax-modal`)

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const modalElement = doc.body.firstChild;
        document.body.appendChild(modalElement);
        setTimeout(() => {
          Woolman.ModalsAndDrawers.showModalOrDrawer(this.targetModalId);
        }, 100);

        this.modal = modalElement;
        this.hookEvents();
      } catch (error) {
        console.error('Error loading quick buy modal:', error);
        this.processingModal = false;
      }
    }

    hookEvents() {
      const closeButton = this.modal.querySelector('[data-close]');
      if (closeButton) {
        closeButton.addEventListener('click', (e) => {
          Woolman.ModalsAndDrawers.closeModalOrDrawerOrDrawerFromEvent(e);
          setTimeout(() => this.cleanupModal(), 300);
        });
      }

      const overlay = this.modal.querySelector('[data-overlay]');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          Woolman.ModalsAndDrawers.closeModalOrDrawerOrDrawerFromEvent(e);
          setTimeout(() => this.cleanupModal(), 300);
        });
      }

      const productForm = document.getElementById(`product-form-${this.dataset.product}`);
      if (productForm) {
        productForm.addEventListener('submit', this.handleSubmit.bind(this));
      }

      this.processingModal = false;
    }

    async handleSubmit() {
      const overlay = this.modal.querySelector('[data-overlay]');
      overlay.click();
      Woolman.ModalsAndDrawers.closeModalOrDrawer(this.targetModalId);

      // Clean up the modal after a short delay to allow the modal to close
      setTimeout(() => {
        this.cleanupModal();
      }, 300);
    }

    cleanupModal() {
      if (this.modal && this.modal.parentNode) {
        // Remove event listeners before removing the element
        const closeButton = this.modal.querySelector('[data-close]');
        if (closeButton) {
          closeButton.removeEventListener('click', Woolman.ModalsAndDrawers.closeModalOrDrawerOrDrawerFromEvent);
        }

        const overlay = this.modal.querySelector('[data-overlay]');
        if (overlay) {
          overlay.removeEventListener('click', Woolman.ModalsAndDrawers.closeModalOrDrawerOrDrawerFromEvent);
        }

        const productForm = document.getElementById(`product-form-${this.dataset.product}`);
        if (productForm) {
          productForm.removeEventListener('submit', this.handleSubmit.bind(this));
        }

        this.modal.remove();
        this.modal = null;
      }
    }
  })
}