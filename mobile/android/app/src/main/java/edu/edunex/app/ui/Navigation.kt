package edu.edunex.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Approval
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.ContactPhone
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DirectionsBus
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Grading
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.MeetingRoom
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.ReportProblem
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material.icons.outlined.Today
import androidx.compose.ui.graphics.vector.ImageVector
import edu.edunex.app.data.User

/** Every screen in the app. Detail screens carry the id they show. */
sealed class Route(val title: String) {
    data object Home : Route("Home")

    // Me — the same for every user
    data object MyAttendance : Route("My Attendance")
    data object Leave : Route("Leave Requests")
    data object Notifications : Route("Notifications")
    data object Tasks : Route("My Tasks")
    data object Profile : Route("My Profile")

    // Teaching
    data object MarkAttendance : Route("Mark Attendance")
    data class Register(val sectionId: String, val label: String) : Route(label)
    data object Homework : Route("Homework")
    data object NewHomework : Route("Set Homework")
    data object Marks : Route("Enter Marks")
    data class MarksEntry(val assessmentId: String, val name: String) : Route(name)
    data object Signals : Route("Early Warning Signals")
    data class Signal(val id: String, val code: String) : Route(code)

    // Parent
    data object ChildTrack : Route("Track Child")
    data object ChildToday : Route("Today at School")
    data object ChildHomework : Route("Homework")
    data object ChildFees : Route("Fees")
    data object Circulars : Route("Circulars")

    // Staff duties
    data object GateLog : Route("Gate Log")
    data object Boarding : Route("Bus Boarding")
    data class BoardingRoute(val routeId: String, val name: String) : Route(name)
    data object Visitors : Route("Visitors")

    // Leadership / HR
    data object Pulse : Route("Today's Pulse")
    data object LeaveApprovals : Route("Leave Approvals")

    /** Read-only list or summary for any API endpoint (finance, admissions, HR lists…). */
    data class Generic(
        val label: String,
        val path: String,
        val list: Boolean,
        val query: Map<String, String> = emptyMap(),
    ) : Route(label)
}

data class Feature(val route: Route, val icon: ImageVector, val label: String = route.title)

data class MenuGroup(val title: String, val items: List<Feature>)

// ---- Feature catalogue ---------------------------------------------------------

private val myAttendance = Feature(Route.MyAttendance, Icons.Outlined.Fingerprint)
private val leave = Feature(Route.Leave, Icons.Outlined.EventBusy)
private val payslips = Feature(Route.Generic("Payslips", "/api/me/payslips", list = true), Icons.Outlined.ReceiptLong, "Payslips")
private val notifications = Feature(Route.Notifications, Icons.Outlined.Notifications)
private val tasks = Feature(Route.Tasks, Icons.Outlined.TaskAlt)
private val profile = Feature(Route.Profile, Icons.Outlined.Person)

private val markAttendance = Feature(Route.MarkAttendance, Icons.Outlined.FactCheck)
private val homework = Feature(Route.Homework, Icons.Outlined.MenuBook, "Set Homework")
private val marks = Feature(Route.Marks, Icons.Outlined.Grading)
private val signals = Feature(Route.Signals, Icons.Outlined.ReportProblem, "Review Signals")

private val childTrack = Feature(Route.ChildTrack, Icons.Outlined.LocationOn)
private val childToday = Feature(Route.ChildToday, Icons.Outlined.Today)
private val childHomework = Feature(Route.ChildHomework, Icons.Outlined.EditNote, "Homework")
private val childFees = Feature(Route.ChildFees, Icons.Outlined.AccountBalanceWallet, "Fees")
private val circulars = Feature(Route.Circulars, Icons.Outlined.Campaign)

private val gateLog = Feature(Route.GateLog, Icons.Outlined.MeetingRoom)
private val boarding = Feature(Route.Boarding, Icons.Outlined.DirectionsBus)
private val visitors = Feature(Route.Visitors, Icons.Outlined.Badge)

private val pulse = Feature(Route.Pulse, Icons.Outlined.Insights)
private val leaveApprovals = Feature(Route.LeaveApprovals, Icons.Outlined.Approval)

private fun generic(label: String, path: String, icon: ImageVector, list: Boolean = true, query: Map<String, String> = emptyMap()) =
    Feature(Route.Generic(label, path, list, query), icon, label)

private val staffToday = generic("Staff Attendance", "/api/workforce/attendance/summary", Icons.Outlined.Groups, list = false)
private val staffDirectory = generic("Staff Directory", "/api/workforce/employees", Icons.Outlined.ContactPhone)
private val feeSummary = generic("Fee Collection", "/api/finance/fees/summary", Icons.Outlined.AccountBalanceWallet, list = false)
private val payments = generic("Payments", "/api/finance/payments", Icons.Outlined.Payments)
private val expenses = generic("Expenses", "/api/finance/expenses", Icons.Outlined.ReceiptLong)
private val reimbursements = generic("Reimbursements", "/api/finance/reimbursements", Icons.Outlined.Payments)
private val enquiries = generic("Enquiries", "/api/enquiries", Icons.Outlined.ContactPhone)
private val followUps = generic("Follow-ups", "/api/follow-ups", Icons.Outlined.TaskAlt)
private val applications = generic("Applications", "/api/applications", Icons.Outlined.Description)
private val admissions = generic("Admissions Summary", "/api/admissions/dashboard", Icons.Outlined.School, list = false)

// ---- Per-user home and menu --------------------------------------------------------

private fun hasSelfService(u: User) = u.can("selfservice.use") && u.employeeId != null

/**
 * The parent portal needs a linked parent record, not just the permission: Super Admin
 * holds every permission through its wildcard grant but has no row in `parents`, and the
 * API answers 404 PARENT_NOT_LINKED. Gate on both, the way [hasSelfService] does.
 */
fun hasParentPortal(u: User) = u.can("parent_portal.use") && u.parentId != null

/** Features the signed-in user may open, in role order. Filtered by API permissions. */
private fun roleFeatures(u: User): List<Feature> {
    val all = buildList {
        if (hasParentPortal(u)) addAll(listOf(childTrack, childToday, childHomework, childFees, circulars))
        if (u.roleKey == "staff" && hasSelfService(u)) add(myAttendance)
        if (u.can("dashboard.view") && u.can("students.read")) add(pulse)
        if (u.can("hr.approve")) add(leaveApprovals)
        if (u.can("attendance.mark")) add(markAttendance)
        if (u.can("academics.manage")) add(homework)
        if (u.can("assessments.manage")) add(marks)
        if (u.can("earlywarning.read")) add(signals)
        if (u.can("admissions.read")) addAll(listOf(enquiries, followUps, applications, admissions))
        if (u.can("finance.read")) addAll(listOf(feeSummary, payments, expenses, reimbursements))
        if (u.can("hr.read")) addAll(listOf(staffToday, staffDirectory))
        if (u.can("safety.read")) addAll(listOf(gateLog, visitors))
        if (u.can("transport.read")) add(boarding)
    }
    return all.distinctBy { it.route }
}

/** The 4–6 big tiles on the home screen: the role's main jobs only. */
fun homeTiles(u: User): List<Feature> {
    val f = roleFeatures(u)
    fun pick(vararg wanted: Feature) = wanted.filter { it in f }
    val tiles = when (u.roleKey) {
        "teacher" -> pick(markAttendance, homework, marks, signals)
        "parent" -> pick(childTrack, childToday, childHomework, childFees, circulars)
        "staff" -> pick(myAttendance, gateLog, boarding, visitors)
        "hr" -> pick(leaveApprovals, staffToday, staffDirectory)
        "finance" -> pick(feeSummary, payments, expenses, reimbursements)
        "office" -> pick(enquiries, followUps, visitors, applications)
        "principal", "school_admin", "super_admin", "management" -> pick(pulse, leaveApprovals, signals, markAttendance)
        "student" -> listOf(profile, notifications, tasks)
        else -> f.take(4)
    }
    return tiles.ifEmpty { f.take(4) }.ifEmpty { listOf(notifications, tasks, profile) }
}

/** Everything else goes in the menu: the role's other tools, then the shared "Me" group. */
fun menuGroups(u: User): List<MenuGroup> {
    val tiles = homeTiles(u).toSet()
    val more = roleFeatures(u).filter { it !in tiles }
    val me = buildList {
        if (hasSelfService(u)) addAll(listOf(myAttendance, leave, payslips))
        addAll(listOf(notifications, tasks, profile))
    }.filter { it !in tiles }
    return buildList {
        if (more.isNotEmpty()) add(MenuGroup("${u.roleName} tools", more))
        add(MenuGroup("Me", me))
    }
}
