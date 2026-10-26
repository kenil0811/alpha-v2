# 26 October 2026: modules dragged in the rail

Vikas wants modules to behave like folders. The core already places a module inside another
(`/api/modules/:id/place`); the rail now does it by dragging too: a module dropped on another goes
inside it, and while a module inside another is dragged, a "Drop here for the top level" strip
takes it out. A target that would put it inside itself, one of its own, or where it already sits
does not light up. The ⋮ Move menu stays as the keyboard's way. Checked in the browser on the test
install: Alpha into Network, Network into Alpha refused, Alpha back to the top.
