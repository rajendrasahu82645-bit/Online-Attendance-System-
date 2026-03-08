function gatdata() {

fetch("https://github.com/rajendrasahu82645-bit/Online-Attendance-System-")

.then(res => res.text())

.then(data => {document.getElementbyId("result").innerHTML = data;})

.catch(error => console.log(error));

}
