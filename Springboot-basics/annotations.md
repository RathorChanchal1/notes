# Difference between @Controller and @RestController
Ans: @RestController combines both @Controller and @ResponseBody. 
     @ResponseBody is useful for serialization of java object to httpResponse.
     while using @Controller only we will need to add @ResponseBody as well for the serialization of object.

eg:
@controller use case
```java
@Controller
@RequestMapping("books")
public class SimpleBookController {

    @GetMapping("/{id}", produces = "application/json")
    public @ResponseBody Book getBook(@PathVariable int id) {
        return findBookById(id);
    }

    private Book findBookById(int id) {
        // ...
    }
}

```
@RestController use case
```java
@RestController
@RequestMapping("books-rest")
public class SimpleBookRestController {
    
    @GetMapping("/{id}", produces = "application/json")
    public Book getBook(@PathVariable int id) {
        return findBookById(id);
    }

    private Book findBookById(int id) {
        // ...
    }
}

```
***