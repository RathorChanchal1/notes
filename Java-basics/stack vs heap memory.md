# Understanding Stack and Heap Memory Allocation

## The Stack — fast, automatic, short-lived
Every time a method is called, the JVM pushes a new stack frame on top of the stack. That frame holds:
* The method's local variables
* Primitive values directly (`int`, `boolean`, `double` — stored right there, not pointed to)
* References (pointers) to heap objects

When the method returns, the frame is instantly popped and that memory is free. No cleanup needed. This is why local variables can't "escape" their method — once the frame is gone, they're gone.

The Stack grows downward in memory (newer frames sit "on top" in a logical sense). Its size is fixed at thread startup — if you recurse too deeply and overflow it, you get a `StackOverflowError`.

---

## The Heap — flexible, managed, long-lived
Every time you write `new`, the object lands on the Heap. The Heap is a large shared pool of memory — all threads share it. Objects live here for as long as at least one reference points to them anywhere in the program. Once nothing refers to them, the Garbage Collector eventually reclaims the space.

**Key rule:** the Stack holds the pointer, the Heap holds the data.

When you pass `User u` to a method, you're copying the address (say `0x2B40`) — both the caller and the method are now looking at the same object on the Heap. Changing the object's fields inside the method changes it for everyone. But reassigning the reference variable itself (`u = new User(...)`) only changes your local copy of the address.

---

## Why this split exists

| Feature | Stack | Heap |
| :--- | :--- | :--- |
| **Speed** | Extremely fast (just move the pointer) | Slower (GC overhead) |
| **Size** | Small (~1MB per thread) | Large (GBs available) |
| **Lifetime** | Tied to method call | Lives until no references remain |
| **What lives here** | Primitives, references | Objects, arrays, strings |
| **Who manages it** | Automatically (call/return) | Garbage Collector |

This is also why memory leaks in Java happen on the Heap — you hold a reference to an object longer than needed (e.g. in a static list), so the GC can't collect it, and the Heap slowly fills up.

---

## Interactive visualizer

Step through stack frames and heap objects as methods call each other — click each step to see what lands on the stack vs the heap.

<!-- embed: Java-basics/heap_stack_memory_explainer.html -->

---

## What is "Memory Fragmentation"?
Memory fragmentation occurs during memory allocation when the OS assigns heap memory to a program. Because of dynamic memory allocation, the heap is divided into small pieces, leaving many empty spaces in between the allocated memory. We cannot fit other data into these gaps because the remaining spaces are too small. This is what is called memory fragmentation.