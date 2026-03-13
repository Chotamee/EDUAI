function doPost(e) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheets if they do not exist
  var testsSheet = spreadsheet.getSheetByName("Тесттер базасы");
  if (!testsSheet) {
    testsSheet = spreadsheet.insertSheet("Тесттер базасы");
    testsSheet.appendRow(["Тест ID", "Жасалған күні", "Тақырыбы", "Қиындығы", "Сұрақтар саны", "Сұрақтар (JSON)"]);
    testsSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  
  var resultsSheet = spreadsheet.getSheetByName("Жауаптар");
  if (!resultsSheet) {
    resultsSheet = spreadsheet.insertSheet("Жауаптар");
    resultsSheet.appendRow(["Уақыты", "Оқушы аты", "Тест ID", "Тақырыбы", "Қиындығы", "Нәтижесі", "Өту уақыты", "Толығырақ (JSON)"]);
    resultsSheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }

  try {
    // Parse the payload. It is sent as text/plain to avoid CORS preflight, but contains JSON.
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === "get_tests") {
      // Logic to fetch all tests from "Тесттер базасы"
      var data = testsSheet.getDataRange().getValues();
      var tests = [];
      
      // Skip header row
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0]) { // If ID exists
          tests.push({
            id: row[0],
            date: row[1],
            topic: row[2],
            difficulty: row[3],
            count: row[4],
            questions: row[5] // The JSON string of questions
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        "result": "success", 
        "tests": tests
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (action === "get_results") {
      // Fetch all student results from "Жауаптар"
      var data = resultsSheet.getDataRange().getValues();
      var results = [];
      
      // Skip header
      for (var i = 1; i < data.length; i++) {
        results.push({
          "timestamp": data[i][0],
          "studentName": data[i][1],
          "testId": data[i][2],
          "topic": data[i][3],
          "difficulty": data[i][4],
          "score": data[i][5],
          "time": data[i][6],
          "details": data[i][7]
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        "result": "success", 
        "results": results
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (action === "save_test") {
      // Save new generated test to "Тесттер базасы"
      var timestamp = new Date();
      var testId = "TEST_" + Utilities.getUuid().substring(0, 8); // Generate short unique ID
      
      var topic = payload.topic || "Тақырыпсыз";
      var difficulty = payload.difficulty || "Орташа";
      var count = payload.count || 0;
      var questionsJson = payload.questions || "[]"; // Should be stringified JSON
      
      testsSheet.appendRow([testId, timestamp, topic, difficulty, count, questionsJson]);
      
      return ContentService.createTextOutput(JSON.stringify({
        "result": "success", 
        "testId": testId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (action === "save_result") {
      // Save student response to "Жауаптар"
      var timestamp = new Date();
      var studentName = payload.studentName || "Аноним";
      var testId = payload.testId || "N/A";
      var topic = payload.topic || "Көрсетілмеген";
      var difficulty = payload.difficulty || "Көрсетілмеген";
      var score = payload.score || "0";
      var time = payload.time || "00:00";
      var details = payload.details || "[]";
      
      resultsSheet.appendRow([timestamp, studentName, testId, topic, difficulty, score, time, details]);
      
      return ContentService.createTextOutput(JSON.stringify({
        "result": "success", 
        "message": "Нәтижелер сақталды"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    else {
      throw new Error("Unknown action parameter: " + action);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error", 
      "error": error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Test Bank API is running. Use POST to interact.")
    .setMimeType(ContentService.MimeType.TEXT);
}
