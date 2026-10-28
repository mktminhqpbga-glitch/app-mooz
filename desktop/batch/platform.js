/* media-studio resolves bundled FFmpeg assets through this narrow URL helper. */
globalThis.chrome={runtime:{getURL:file=>new URL('../../'+file,location.href).href}};
