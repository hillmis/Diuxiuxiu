// 简单的权限与环境初始化
        if (typeof webapp !== 'undefined') {
            try { webapp.circle(false); webapp.renew(false); webapp.rights(); } catch (e) { }
        }

webapp.circle(false);
        //关闭加载效果true打开
        webapp.renew(false);
        //关闭下拉刷新true打开
        webapp.rights();
        //申请存储权限
